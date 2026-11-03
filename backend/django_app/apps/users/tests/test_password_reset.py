"""Tests for the password reset: asking for the link (POST
/api/users/password-reset/) and setting the new password from it (POST
/api/users/password-reset/confirm/)."""

import re
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from apps.users.tokens import PASSWORD_RESET_TIMEOUT, encode_uid, password_reset_token
from django.conf import settings
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

REGISTER = "users:register"
LOGIN = "users:login"
REFRESH = "users:token-refresh"
REQUEST = "users:password-reset"
CONFIRM = "users:password-reset-confirm"
INVALID_LINK = "This link is invalid or has expired."
NEW_PASSWORD = "Fresh!Start-2026"


def _request(email, client=None, capture=None):
    client = client or APIClient()
    with capture(execute=True):
        return client.post(reverse(REQUEST), {"email": email}, format="json")


# --- POST password-reset/ --------------------------------------------------


@pytest.mark.django_db
def test_a_known_address_gets_a_reset_link(user, django_capture_on_commit_callbacks):
    resp = _request(user.email, capture=django_capture_on_commit_callbacks)

    assert resp.status_code == 204
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [user.email]
    assert f"{settings.SITE_URL}/reset-password?" in mail.outbox[0].body


@pytest.mark.django_db
def test_known_and_unknown_addresses_get_the_same_answer(
    user, django_capture_on_commit_callbacks
):
    """Nothing in the reply may tell a stranger who is registered here; only
    the owner's inbox learns the difference."""
    known = _request(user.email, capture=django_capture_on_commit_callbacks)
    unknown = _request("nobody@test.com", capture=django_capture_on_commit_callbacks)

    assert known.status_code == unknown.status_code == 204
    assert known.content == unknown.content == b""
    assert [m.to for m in mail.outbox] == [[user.email]]


@pytest.mark.django_db
def test_the_address_matches_in_any_case(user, django_capture_on_commit_callbacks):
    resp = _request(user.email.upper(), capture=django_capture_on_commit_callbacks)

    assert resp.status_code == 204
    assert mail.outbox[0].to == [user.email]


@pytest.mark.django_db
def test_an_unverified_address_still_gets_the_link(
    user, django_capture_on_commit_callbacks
):
    """The reset is how an address gets proved: the link only reaches the inbox
    of whoever owns it."""
    assert user.email_verified is False

    _request(user.email, capture=django_capture_on_commit_callbacks)

    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_a_passwordless_oauth_user_gets_the_link(
    user, django_capture_on_commit_callbacks
):
    user.set_unusable_password()
    user.save()

    _request(user.email, capture=django_capture_on_commit_callbacks)

    assert len(mail.outbox) == 1
    assert "set a password" in mail.outbox[0].body


@pytest.mark.django_db
def test_a_deactivated_account_gets_nothing_but_the_same_answer(
    user, django_capture_on_commit_callbacks
):
    user.is_active = False
    user.save(update_fields=["is_active"])

    resp = _request(user.email, capture=django_capture_on_commit_callbacks)

    assert resp.status_code == 204
    assert mail.outbox == []


@pytest.mark.django_db
@pytest.mark.parametrize("payload", [{}, {"email": ""}, {"email": "not-an-email"}])
def test_a_request_without_an_address_is_refused(payload):
    resp = APIClient().post(reverse(REQUEST), payload, format="json")

    assert resp.status_code == 400
    assert "email" in resp.data


@pytest.mark.django_db
def test_the_request_works_signed_out_and_ignores_a_stale_token(
    user, django_capture_on_commit_callbacks
):
    """Asked for from the login page, often with a dead token still around."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-jwt")

    resp = _request(user.email, client, capture=django_capture_on_commit_callbacks)

    assert resp.status_code == 204
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_the_path_cannot_be_taken_as_a_username():
    taken = {
        "username": "password-reset",
        "email": "someone@test.com",
        "password": "S3cure!pass",
    }

    resp = APIClient().post(reverse(REGISTER), taken, format="json")

    assert resp.status_code == 400
    assert "username" in resp.data


# --- POST password-reset/confirm/ ------------------------------------------


def _good_link(user, new_password=NEW_PASSWORD):
    return {
        "uid": encode_uid(user),
        "token": password_reset_token.make_token(user),
        "new_password": new_password,
    }


def _confirm(payload, client=None):
    return (client or APIClient()).post(reverse(CONFIRM), payload, format="json")


def _can_log_in(username, password):
    resp = APIClient().post(
        reverse(LOGIN), {"username": username, "password": password}, format="json"
    )
    return resp.status_code == 200


@pytest.mark.django_db
def test_a_valid_link_sets_the_new_password(user):
    resp = _confirm(_good_link(user))

    assert resp.status_code == 204
    assert resp.content == b""  # no new pair: the user simply signs in
    assert _can_log_in(user.username, NEW_PASSWORD)
    assert not _can_log_in(user.username, "pass")


@pytest.mark.django_db
def test_a_reset_verifies_the_email(user):
    """The link reached the inbox, which is all verification ever proves."""
    assert user.email_verified is False

    _confirm(_good_link(user))

    user.refresh_from_db()
    assert user.email_verified is True


@pytest.mark.django_db
def test_a_reset_ends_every_session(user):
    old_refresh = str(RefreshToken.for_user(user))

    _confirm(_good_link(user))

    resp = APIClient().post(reverse(REFRESH), {"refresh": old_refresh}, format="json")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_the_same_link_twice_is_refused(user):
    payload = _good_link(user)
    assert _confirm(payload).status_code == 204

    resp = _confirm({**payload, "new_password": "Another!Pass-77"})

    assert resp.status_code == 400
    assert resp.data == {"detail": INVALID_LINK}
    assert _can_log_in(user.username, NEW_PASSWORD)


@pytest.mark.django_db
def test_an_expired_link_is_refused(monkeypatch, user):
    payload = _good_link(user)
    later = datetime.now() + timedelta(seconds=PASSWORD_RESET_TIMEOUT + 1)
    monkeypatch.setattr(password_reset_token, "_now", lambda: later)

    resp = _confirm(payload)

    assert resp.status_code == 400
    assert resp.data == {"detail": INVALID_LINK}
    assert _can_log_in(user.username, "pass")


@pytest.mark.django_db
@pytest.mark.parametrize("weak", ["123", "password", "12345678", "user@test.com"])
def test_a_weak_password_is_refused_and_the_link_stays_good(user, weak):
    """The user's own email is long and not a common password, so only the
    similarity check can turn it down — proof the validators run with the
    user, like on a password change."""
    payload = _good_link(user, new_password=weak)

    resp = _confirm(payload)

    assert resp.status_code == 400
    assert "new_password" in resp.data
    user.refresh_from_db()
    assert user.email_verified is False
    assert _can_log_in(user.username, "pass")
    # Nothing changed, so the same link still works for a better password.
    assert _confirm({**payload, "new_password": NEW_PASSWORD}).status_code == 204


@pytest.mark.django_db
def test_someone_elses_uid_with_my_token_is_refused(user, other):
    payload = {**_good_link(user), "uid": encode_uid(other)}

    resp = _confirm(payload)

    assert resp.status_code == 400
    assert _can_log_in(other.username, "pass")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"uid": "MQ", "token": "abc-def"},
        {"uid": "MQ", "new_password": NEW_PASSWORD},
        {"uid": "!!!", "token": "abc-def", "new_password": NEW_PASSWORD},
        {"uid": "MQ", "token": "abc-def", "new_password": NEW_PASSWORD},
    ],
)
def test_a_broken_request_is_refused(user, payload):
    assert _confirm(payload).status_code == 400
    assert _can_log_in(user.username, "pass")


@pytest.mark.django_db
def test_a_passwordless_oauth_user_sets_a_first_password(user):
    user.set_unusable_password()
    user.save()

    resp = _confirm(_good_link(user))

    assert resp.status_code == 204
    assert _can_log_in(user.username, NEW_PASSWORD)


@pytest.mark.django_db
def test_the_confirm_works_signed_out_and_ignores_a_stale_token(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-jwt")

    assert _confirm(_good_link(user), client).status_code == 204


@pytest.mark.django_db
def test_from_the_request_to_signing_in(user, django_capture_on_commit_callbacks):
    """The whole flow as a person goes through it: ask, open the email, set a
    password, sign in with it."""
    _request(user.email, capture=django_capture_on_commit_callbacks)
    (url,) = re.findall(r"https?://\S+", mail.outbox[0].body)
    query = parse_qs(urlparse(url).query)

    resp = _confirm(
        {
            "uid": query["uid"][0],
            "token": query["token"][0],
            "new_password": NEW_PASSWORD,
        }
    )

    assert resp.status_code == 204
    assert _can_log_in(user.email, NEW_PASSWORD)
