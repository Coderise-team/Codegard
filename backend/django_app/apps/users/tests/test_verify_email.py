"""Tests for the verification email at sign-up and POST /api/users/verify-email/."""

import re
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from apps.users.tokens import (
    EMAIL_VERIFICATION_TIMEOUT,
    email_verification_token,
    encode_uid,
)
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

User = get_user_model()

REGISTER = "users:register"
VERIFY = "users:verify-email"
INVALID_LINK = "This link is invalid or has expired."

SIGN_UP = {
    "username": "newcomer",
    "email": "newcomer@test.com",
    "password": "S3cure!pass",
}


def _link_params(email):
    (url,) = re.findall(r"https?://\S+", email.body)
    query = parse_qs(urlparse(url).query)
    return {"uid": query["uid"][0], "token": query["token"][0]}


def _good_link(user):
    return {"uid": encode_uid(user), "token": email_verification_token.make_token(user)}


def _verify(payload, client=None):
    return (client or APIClient()).post(reverse(VERIFY), payload, format="json")


# --- the email sent at sign-up ---------------------------------------------


@pytest.mark.django_db
def test_sign_up_sends_exactly_one_verification_email(
    django_capture_on_commit_callbacks,
):
    with django_capture_on_commit_callbacks(execute=True):
        resp = APIClient().post(reverse(REGISTER), SIGN_UP, format="json")

    assert resp.status_code == 201
    assert "access" in resp.data and "refresh" in resp.data
    assert len(mail.outbox) == 1
    email = mail.outbox[0]
    assert email.to == ["newcomer@test.com"]
    assert f"{settings.SITE_URL}/verify-email?" in email.body
    assert User.objects.get(username="newcomer").email_verified is False


@pytest.mark.django_db
def test_a_refused_sign_up_sends_nothing(user, django_capture_on_commit_callbacks):
    taken = {**SIGN_UP, "email": user.email}

    with django_capture_on_commit_callbacks(execute=True):
        resp = APIClient().post(reverse(REGISTER), taken, format="json")

    assert resp.status_code == 400
    assert mail.outbox == []


@pytest.mark.django_db
def test_the_emailed_link_verifies_the_new_account(
    django_capture_on_commit_callbacks,
):
    with django_capture_on_commit_callbacks(execute=True):
        APIClient().post(reverse(REGISTER), SIGN_UP, format="json")

    resp = _verify(_link_params(mail.outbox[0]))

    assert resp.status_code == 200
    assert User.objects.get(username="newcomer").email_verified is True


@pytest.mark.django_db
def test_the_path_cannot_be_taken_as_a_username():
    """Otherwise a user called "verify-email" would lose their profile URL."""
    taken = {**SIGN_UP, "username": "verify-email"}

    resp = APIClient().post(reverse(REGISTER), taken, format="json")

    assert resp.status_code == 400
    assert "username" in resp.data


# --- POST verify-email/ ----------------------------------------------------


@pytest.mark.django_db
def test_a_valid_link_verifies(user):
    resp = _verify(_good_link(user))

    assert resp.status_code == 200
    assert resp.data == {"detail": "Email verified."}
    user.refresh_from_db()
    assert user.email_verified is True


@pytest.mark.django_db
def test_the_same_link_twice_is_refused(user):
    payload = _good_link(user)
    assert _verify(payload).status_code == 200

    resp = _verify(payload)

    assert resp.status_code == 400
    assert resp.data == {"detail": INVALID_LINK}


@pytest.mark.django_db
def test_an_expired_link_is_refused(monkeypatch, user):
    payload = _good_link(user)
    later = datetime.now() + timedelta(seconds=EMAIL_VERIFICATION_TIMEOUT + 1)
    monkeypatch.setattr(email_verification_token, "_now", lambda: later)

    resp = _verify(payload)

    assert resp.status_code == 400
    assert resp.data == {"detail": INVALID_LINK}
    user.refresh_from_db()
    assert user.email_verified is False


@pytest.mark.django_db
def test_someone_elses_uid_with_my_token_is_refused(user, other):
    """My token proves nothing about another account."""
    payload = {
        "uid": encode_uid(other),
        "token": email_verification_token.make_token(user),
    }

    resp = _verify(payload)

    assert resp.status_code == 400
    other.refresh_from_db()
    user.refresh_from_db()
    assert other.email_verified is False
    assert user.email_verified is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"uid": "MQ"},
        {"token": "abc-def"},
        {"uid": "!!!", "token": "abc-def"},
        {"uid": "MQ", "token": "abc-def"},
    ],
)
def test_a_broken_request_is_refused(user, payload):
    assert _verify(payload).status_code == 400


@pytest.mark.django_db
def test_works_signed_out_and_ignores_a_stale_token(user):
    """The link is often opened in another browser, or next to a dead token."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-jwt")

    resp = _verify(_good_link(user), client)

    assert resp.status_code == 200
