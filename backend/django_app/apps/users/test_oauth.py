"""Tests for the OAuth login flow: start -> callback -> redeem."""

from unittest.mock import patch

import pytest
from apps.users import oauth
from apps.users.models import OAuthAccount, User
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

GOOGLE_IDENTITY = {
    "uid": "google-uid-1",
    "email": "alice@test.com",
    "email_verified": True,
    "username_hint": "alice",
}


@pytest.fixture(autouse=True)
def _providers(settings):
    settings.OAUTH_PROVIDERS = {
        "google": {"client_id": "cid", "client_secret": "sec"},
        "github": {"client_id": "cid", "client_secret": "sec"},
    }


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


def _callback(client, identity, provider="google"):
    """Drive the callback with the provider HTTP mocked out."""
    state = oauth.issue_state(provider)
    with (
        patch.object(oauth, "exchange_code", return_value="provider-token"),
        patch.object(oauth, "fetch_identity", return_value=identity),
    ):
        return client.get(
            reverse("users:oauth-callback", args=[provider]),
            {"code": "x", "state": state},
        )


@pytest.mark.django_db
def test_start_returns_authorize_url_with_state(client):
    body = client.get(reverse("users:oauth-start", args=["google"])).json()
    assert "accounts.google.com" in body["authorize_url"]
    assert "state=" in body["authorize_url"]


@pytest.mark.django_db
def test_start_rejects_unconfigured_provider(client, settings):
    settings.OAUTH_PROVIDERS = {"google": {"client_id": "", "client_secret": ""}}
    resp = client.get(reverse("users:oauth-start", args=["google"]))
    assert resp.status_code == 400


@pytest.mark.django_db
def test_callback_rejects_forged_state(client):
    resp = client.get(
        reverse("users:oauth-callback", args=["google"]),
        {"code": "x", "state": "forged"},
    )
    assert resp.status_code == 302
    assert "oauth_error" in resp["Location"]
    assert User.objects.count() == 0


@pytest.mark.django_db
def test_state_is_single_use(client):
    state = oauth.issue_state("google")
    assert oauth.redeem_state("google", state) is True
    assert oauth.redeem_state("google", state) is False


@pytest.mark.django_db
def test_callback_creates_user_and_redeem_gives_tokens(client):
    resp = _callback(client, GOOGLE_IDENTITY)
    assert resp.status_code == 302
    assert resp["Location"].startswith("/oauth/callback?ticket=")

    user = User.objects.get(email="alice@test.com")
    assert not user.has_usable_password()
    assert OAuthAccount.objects.filter(
        user=user, provider="google", provider_uid="google-uid-1"
    ).exists()

    ticket = resp["Location"].split("ticket=")[1]
    redeem = client.post(reverse("users:oauth-redeem"), {"ticket": ticket})
    assert redeem.status_code == 200
    assert {"access", "refresh"} <= set(redeem.json())

    again = client.post(reverse("users:oauth-redeem"), {"ticket": ticket})
    assert again.status_code == 400  # single-use


@pytest.mark.django_db
def test_callback_links_existing_user_by_verified_email(client, django_user_model):
    existing = django_user_model.objects.create_user(
        username="alice", email="alice@test.com", password="pass"
    )
    _callback(client, GOOGLE_IDENTITY)
    assert User.objects.count() == 1
    assert OAuthAccount.objects.get(provider_uid="google-uid-1").user == existing


@pytest.mark.django_db
def test_callback_refuses_unverified_email(client):
    resp = _callback(client, {**GOOGLE_IDENTITY, "email_verified": False})
    assert "oauth_error" in resp["Location"]
    assert User.objects.count() == 0
    assert OAuthAccount.objects.count() == 0


@pytest.mark.django_db
def test_second_login_same_uid_reuses_user(client):
    _callback(client, GOOGLE_IDENTITY)
    _callback(client, GOOGLE_IDENTITY)
    assert User.objects.count() == 1
    assert OAuthAccount.objects.count() == 1


@pytest.mark.django_db
def test_username_collision_gets_suffix(client, django_user_model):
    django_user_model.objects.create_user(
        username="alice", email="other@test.com", password="pass"
    )
    _callback(client, GOOGLE_IDENTITY)
    created = User.objects.get(email="alice@test.com")
    assert created.username != "alice"
    assert created.username.startswith("alice")


@pytest.mark.django_db
def test_reserved_username_hint_is_not_used(client):
    identity = {
        **GOOGLE_IDENTITY,
        "uid": "google-uid-2",
        "email": "me@test.com",
        "username_hint": "me",
    }
    _callback(client, identity)
    created = User.objects.get(email="me@test.com")
    assert created.username != "me"
