"""Tests for the OAuth login flow: start -> callback -> redeem."""

from unittest.mock import patch

import pytest
from apps.users import oauth
from apps.users.models import OAuthAccount, User
from django.core.cache import cache
from django.db import IntegrityError
from django.urls import reverse

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


# api_client comes from conftest.


def _callback(api_client, identity, provider="google"):
    """Drive the callback with the provider HTTP mocked out."""
    state = oauth.issue_state(provider)
    with (
        patch.object(oauth, "exchange_code", return_value="provider-token"),
        patch.object(oauth, "fetch_identity", return_value=identity),
    ):
        return api_client.get(
            reverse("users:oauth-callback", args=[provider]),
            {"code": "x", "state": state},
        )


@pytest.mark.django_db
def test_start_returns_authorize_url_with_state(api_client):
    body = api_client.get(reverse("users:oauth-start", args=["google"])).json()
    assert "accounts.google.com" in body["authorize_url"]
    assert "state=" in body["authorize_url"]


@pytest.mark.django_db
def test_start_rejects_unconfigured_provider(api_client, settings):
    settings.OAUTH_PROVIDERS = {"google": {"client_id": "", "client_secret": ""}}
    resp = api_client.get(reverse("users:oauth-start", args=["google"]))
    assert resp.status_code == 400


@pytest.mark.django_db
def test_callback_rejects_forged_state(api_client):
    resp = api_client.get(
        reverse("users:oauth-callback", args=["google"]),
        {"code": "x", "state": "forged"},
    )
    assert resp.status_code == 302
    assert "oauth_error" in resp["Location"]
    assert User.objects.count() == 0


@pytest.mark.django_db
def test_state_is_single_use(api_client):
    state = oauth.issue_state("google")
    assert oauth.redeem_state("google", state) is True
    assert oauth.redeem_state("google", state) is False


@pytest.mark.django_db
def test_callback_creates_user_and_redeem_gives_tokens(api_client):
    resp = _callback(api_client, GOOGLE_IDENTITY)
    assert resp.status_code == 302
    assert resp["Location"].startswith("/oauth/callback?ticket=")

    user = User.objects.get(email="alice@test.com")
    assert not user.has_usable_password()
    assert OAuthAccount.objects.filter(
        user=user, provider="google", provider_uid="google-uid-1"
    ).exists()

    ticket = resp["Location"].split("ticket=")[1]
    redeem = api_client.post(reverse("users:oauth-redeem"), {"ticket": ticket})
    assert redeem.status_code == 200
    assert {"access", "refresh"} <= set(redeem.json())

    again = api_client.post(reverse("users:oauth-redeem"), {"ticket": ticket})
    assert again.status_code == 400  # single-use


@pytest.mark.django_db
def test_callback_links_existing_user_by_verified_email(api_client, django_user_model):
    existing = django_user_model.objects.create_user(
        username="alice", email="alice@test.com", password="pass"
    )
    _callback(api_client, GOOGLE_IDENTITY)
    assert User.objects.count() == 1
    assert OAuthAccount.objects.get(provider_uid="google-uid-1").user == existing


@pytest.mark.django_db
def test_callback_refuses_unverified_email(api_client):
    resp = _callback(api_client, {**GOOGLE_IDENTITY, "email_verified": False})
    assert "oauth_error" in resp["Location"]
    assert User.objects.count() == 0
    assert OAuthAccount.objects.count() == 0


@pytest.mark.django_db
def test_second_login_same_uid_reuses_user(api_client):
    _callback(api_client, GOOGLE_IDENTITY)
    _callback(api_client, GOOGLE_IDENTITY)
    assert User.objects.count() == 1
    assert OAuthAccount.objects.count() == 1


@pytest.mark.django_db
def test_username_collision_gets_suffix(api_client, django_user_model):
    django_user_model.objects.create_user(
        username="alice", email="other@test.com", password="pass"
    )
    _callback(api_client, GOOGLE_IDENTITY)
    created = User.objects.get(email="alice@test.com")
    assert created.username != "alice"
    assert created.username.startswith("alice")


@pytest.mark.django_db
def test_reserved_username_hint_is_not_used(api_client):
    identity = {
        **GOOGLE_IDENTITY,
        "uid": "google-uid-2",
        "email": "me@test.com",
        "username_hint": "me",
    }
    _callback(api_client, identity)
    created = User.objects.get(email="me@test.com")
    assert created.username != "me"


# --- OAuthAccount model constraint ---


@pytest.mark.django_db
def test_provider_uid_pair_is_unique(django_user_model):
    """The same (provider, provider_uid) can't be linked twice — DB constraint."""
    u1 = django_user_model.objects.create_user(
        username="one", email="one@test.com", password="pass"
    )
    u2 = django_user_model.objects.create_user(
        username="two", email="two@test.com", password="pass"
    )
    OAuthAccount.objects.create(user=u1, provider="google", provider_uid="dup-uid")
    with pytest.raises(IntegrityError):
        OAuthAccount.objects.create(user=u2, provider="google", provider_uid="dup-uid")
