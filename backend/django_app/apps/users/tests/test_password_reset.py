"""Tests for the password reset: asking for the link (POST
/api/users/password-reset/)."""

import pytest
from django.conf import settings
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

REGISTER = "users:register"
REQUEST = "users:password-reset"


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
def test_works_signed_out_and_ignores_a_stale_token(
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
