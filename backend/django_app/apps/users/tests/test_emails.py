"""Tests for the account emails: their links, their text and how they are sent."""

import re
from smtplib import SMTPServerDisconnected
from urllib.parse import parse_qs, urlparse

import pytest
from apps.users import tasks
from apps.users.emails import _lifetime
from apps.users.tasks import (
    queue_password_reset_email,
    queue_verification_email,
    send_password_reset_email,
    send_verification_email,
)
from apps.users.tokens import (
    email_verification_token,
    password_reset_token,
    user_from_uid,
)
from django.conf import settings
from django.core import mail


def _only_email():
    assert len(mail.outbox) == 1
    return mail.outbox[0]


def _link(email):
    """The one link in an email, split into (url without query, uid, token)."""
    (url,) = re.findall(r"https?://\S+", email.body)
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    return url.split("?")[0], query["uid"][0], query["token"][0]


# --- sending after the commit ----------------------------------------------


@pytest.mark.django_db
def test_verification_email_waits_for_the_commit(
    user, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        queue_verification_email(user)
        assert mail.outbox == []

    assert len(callbacks) == 1
    assert _only_email().to == [user.email]


@pytest.mark.django_db
def test_reset_email_waits_for_the_commit(user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        queue_password_reset_email(user)
        assert mail.outbox == []

    assert len(callbacks) == 1
    assert _only_email().to == [user.email]


@pytest.mark.django_db
def test_only_the_user_id_goes_to_the_broker(
    monkeypatch, user, django_capture_on_commit_callbacks
):
    """The token is made by the worker, so no secret sits in Redis."""
    queued = []
    monkeypatch.setattr(
        send_verification_email, "delay", lambda *args: queued.append(args)
    )

    with django_capture_on_commit_callbacks(execute=True):
        queue_verification_email(user)

    assert queued == [(user.pk,)]


# --- verification email ----------------------------------------------------


@pytest.mark.django_db
def test_verification_email_carries_a_working_link(user):
    send_verification_email(user.pk)

    email = _only_email()
    url, uid, token = _link(email)
    assert url == f"{settings.SITE_URL}/verify-email"
    assert user_from_uid(uid) == user
    assert email_verification_token.check_token(user, token)


@pytest.mark.django_db
def test_verification_email_text(user):
    send_verification_email(user.pk)

    email = _only_email()
    assert email.from_email == settings.DEFAULT_FROM_EMAIL
    assert email.subject == "Confirm your email for Codegard"
    assert user.email in email.body
    assert "3 days" in email.body
    assert "ignore this email" in email.body


@pytest.mark.django_db
def test_a_verified_user_gets_no_verification_email(user):
    user.email_verified = True
    user.save(update_fields=["email_verified"])

    assert send_verification_email(user.pk) is False
    assert mail.outbox == []


# --- password reset email --------------------------------------------------


@pytest.mark.django_db
def test_reset_email_carries_a_working_link(user):
    send_password_reset_email(user.pk)

    email = _only_email()
    url, uid, token = _link(email)
    assert url == f"{settings.SITE_URL}/reset-password"
    assert user_from_uid(uid) == user
    assert password_reset_token.check_token(user, token)


@pytest.mark.django_db
def test_reset_email_text(user):
    send_password_reset_email(user.pk)

    email = _only_email()
    assert email.subject == "Reset your Codegard password"
    assert "reset the password" in email.body
    assert "1 hour and only once" in email.body
    assert "Your password stays the same" in email.body


@pytest.mark.django_db
def test_a_passwordless_user_is_offered_to_set_a_password(user):
    user.set_unusable_password()
    user.save()

    send_password_reset_email(user.pk)

    body = _only_email().body
    assert "set a password" in body
    assert "Your password stays the same" not in body


# --- who gets nothing ------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("task", [send_verification_email, send_password_reset_email])
def test_a_deactivated_account_gets_nothing(user, task):
    user.is_active = False
    user.save(update_fields=["is_active"])

    assert task(user.pk) is False
    assert mail.outbox == []


@pytest.mark.django_db
@pytest.mark.parametrize("task", [send_verification_email, send_password_reset_email])
def test_a_deleted_account_gets_nothing(user, task):
    user_id = user.pk
    user.delete()

    assert task(user_id) is False
    assert mail.outbox == []


# --- retries ---------------------------------------------------------------


@pytest.mark.django_db
def test_a_failed_send_is_retried(monkeypatch, user):
    attempts = []
    real_send_mail = tasks.send_mail

    def flaky_send_mail(*args, **kwargs):
        attempts.append(1)
        if len(attempts) == 1:
            raise SMTPServerDisconnected("relay went away")
        return real_send_mail(*args, **kwargs)

    monkeypatch.setattr(tasks, "send_mail", flaky_send_mail)

    send_verification_email.delay(user.pk)

    assert len(attempts) == 2
    assert _only_email().to == [user.email]


# --- wording helpers -------------------------------------------------------


@pytest.mark.parametrize(
    ("seconds", "text"),
    [(3600, "1 hour"), (7200, "2 hours"), (86400, "1 day"), (259200, "3 days")],
)
def test_lifetime_reads_naturally(seconds, text):
    assert _lifetime(seconds) == text
