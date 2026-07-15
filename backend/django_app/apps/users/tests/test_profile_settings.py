"""Tests for profile editing (PATCH /me/) and password change (POST /me/password/)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="yurii",
        email="yurii@test.com",
        password="OldPass!234",
        first_name="Old",
        last_name="Name",
        bio="old bio",
    )


@pytest.fixture
def auth(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


ME = "users:me"
ME_PASSWORD = "users:me-password"
REFRESH = "users:token-refresh"


# --- Step 1: PATCH profile -------------------------------------------------


@pytest.mark.django_db
def test_patch_updates_editable_fields(auth, user):
    resp = auth.patch(
        reverse(ME),
        {"bio": "hi", "first_name": "Yurii", "last_name": ""},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.bio == "hi"
    assert user.first_name == "Yurii"
    assert user.last_name == ""


@pytest.mark.django_db
def test_patch_is_partial(auth, user):
    # Only bio sent -> first_name / last_name untouched.
    resp = auth.patch(reverse(ME), {"bio": "changed"}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.bio == "changed"
    assert user.first_name == "Old"
    assert user.last_name == "Name"


@pytest.mark.django_db
def test_patch_ignores_forbidden_fields(auth, user):
    # username / email / elo_rating are not in the write serializer -> ignored.
    resp = auth.patch(
        reverse(ME),
        {
            "username": "hacker",
            "email": "hacker@evil.com",
            "elo_rating": 9999,
            "bio": "legit",
        },
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.username == "yurii"
    assert user.email == "yurii@test.com"
    assert user.elo_rating == 1200
    assert user.bio == "legit"  # the allowed field still went through


@pytest.mark.django_db
def test_get_me_returns_new_fields(auth):
    data = auth.get(reverse(ME)).json()
    assert data["bio"] == "old bio"
    assert data["first_name"] == "Old"
    assert data["last_name"] == "Name"
    assert data["username"] == "yurii"


@pytest.mark.django_db
def test_me_anonymous_401():
    assert APIClient().get(reverse(ME)).status_code == 401


@pytest.mark.django_db
def test_me_put_not_allowed(auth):
    resp = auth.put(reverse(ME), {"bio": "x"}, format="json")
    assert resp.status_code == 405


# --- Step 2: password change -----------------------------------------------


@pytest.mark.django_db
def test_password_change_success(auth, user):
    resp = auth.post(
        reverse(ME_PASSWORD),
        {"old_password": "OldPass!234", "new_password": "BrandNew!567"},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.json() and "refresh" in resp.json()

    user.refresh_from_db()
    assert not user.check_password("OldPass!234")
    assert user.check_password("BrandNew!567")


@pytest.mark.django_db
def test_old_refresh_dies_new_one_works(auth, user):
    # An outstanding refresh token issued before the change...
    old_refresh = str(RefreshToken.for_user(user))

    resp = auth.post(
        reverse(ME_PASSWORD),
        {"old_password": "OldPass!234", "new_password": "BrandNew!567"},
        format="json",
    )
    fresh_refresh = resp.json()["refresh"]

    # ...is blacklisted -> refresh with it fails.
    dead = APIClient().post(reverse(REFRESH), {"refresh": old_refresh}, format="json")
    assert dead.status_code == 401

    # ...while the pair returned by the change still works.
    alive = APIClient().post(
        reverse(REFRESH), {"refresh": fresh_refresh}, format="json"
    )
    assert alive.status_code == 200


@pytest.mark.django_db
def test_password_change_wrong_old(auth, user):
    resp = auth.post(
        reverse(ME_PASSWORD),
        {"old_password": "WRONG", "new_password": "BrandNew!567"},
        format="json",
    )
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.check_password("OldPass!234")  # unchanged


@pytest.mark.django_db
def test_password_change_weak_new(auth):
    resp = auth.post(
        reverse(ME_PASSWORD),
        {"old_password": "OldPass!234", "new_password": "12345678"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_password_change_oauth_user(user):
    # Simulate an OAuth account (no usable password) without Andrii's branch.
    user.set_unusable_password()
    user.save()
    api = APIClient()
    api.force_authenticate(user=user)

    resp = api.post(
        reverse(ME_PASSWORD),
        {"old_password": "whatever", "new_password": "BrandNew!567"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_password_change_anonymous_401():
    resp = APIClient().post(
        reverse(ME_PASSWORD),
        {"old_password": "x", "new_password": "y"},
        format="json",
    )
    assert resp.status_code == 401
