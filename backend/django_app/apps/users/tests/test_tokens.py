"""Tests for the one-time tokens behind the links in account emails."""

from datetime import datetime, timedelta

import pytest
from apps.users.tokens import (
    EMAIL_VERIFICATION_TIMEOUT,
    PASSWORD_RESET_TIMEOUT,
    email_verification_token,
    encode_uid,
    password_reset_token,
    user_from_uid,
)
from django.conf import settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def _later(monkeypatch, generator, seconds):
    """Check tokens as if ``seconds`` had passed since they were made."""
    moment = datetime.now() + timedelta(seconds=seconds)
    monkeypatch.setattr(generator, "_now", lambda: moment)


def test_the_global_ceiling_covers_both_lifetimes():
    """Django stops every token at PASSWORD_RESET_TIMEOUT before ours get a say,
    so a smaller ceiling would quietly cut verification links short."""
    assert settings.PASSWORD_RESET_TIMEOUT >= EMAIL_VERIFICATION_TIMEOUT
    assert settings.PASSWORD_RESET_TIMEOUT >= PASSWORD_RESET_TIMEOUT


# --- email verification ----------------------------------------------------


@pytest.mark.django_db
def test_verification_token_is_valid_for_its_user(user, other):
    token = email_verification_token.make_token(user)

    assert email_verification_token.check_token(user, token)
    assert not email_verification_token.check_token(other, token)


@pytest.mark.django_db
def test_verification_token_dies_once_the_email_is_verified(user):
    token = email_verification_token.make_token(user)

    user.email_verified = True
    user.save(update_fields=["email_verified"])

    assert not email_verification_token.check_token(user, token)


@pytest.mark.django_db
def test_verification_token_dies_when_the_address_changes(user):
    token = email_verification_token.make_token(user)

    user.email = "elsewhere@test.com"

    assert not email_verification_token.check_token(user, token)


@pytest.mark.django_db
def test_verification_token_lives_three_days(monkeypatch, user):
    token = email_verification_token.make_token(user)

    _later(monkeypatch, email_verification_token, EMAIL_VERIFICATION_TIMEOUT - 60)
    assert email_verification_token.check_token(user, token)

    _later(monkeypatch, email_verification_token, EMAIL_VERIFICATION_TIMEOUT + 1)
    assert not email_verification_token.check_token(user, token)


# --- password reset --------------------------------------------------------


@pytest.mark.django_db
def test_reset_token_dies_once_the_password_changes(user):
    token = password_reset_token.make_token(user)
    assert password_reset_token.check_token(user, token)

    user.set_password("BrandNew!567")
    user.save()

    assert not password_reset_token.check_token(user, token)


@pytest.mark.django_db
def test_reset_token_dies_once_a_passwordless_user_sets_one(user):
    """An OAuth user has an unusable password; setting a real one still changes
    what the hash covers."""
    user.set_unusable_password()
    user.save()
    token = password_reset_token.make_token(user)

    user.set_password("BrandNew!567")
    user.save()

    assert not password_reset_token.check_token(user, token)


@pytest.mark.django_db
def test_reset_token_lives_one_hour_despite_the_longer_ceiling(monkeypatch, user):
    token = password_reset_token.make_token(user)

    _later(monkeypatch, password_reset_token, PASSWORD_RESET_TIMEOUT - 60)
    assert password_reset_token.check_token(user, token)

    _later(monkeypatch, password_reset_token, PASSWORD_RESET_TIMEOUT + 1)
    assert not password_reset_token.check_token(user, token)


@pytest.mark.django_db
def test_the_two_kinds_are_not_interchangeable(user):
    assert not password_reset_token.check_token(
        user, email_verification_token.make_token(user)
    )
    assert not email_verification_token.check_token(
        user, password_reset_token.make_token(user)
    )


@pytest.mark.django_db
@pytest.mark.parametrize("token", [None, 42, "", "garbage", "zzz-abc", "1-2-3"])
def test_malformed_tokens_are_refused(user, token):
    assert not email_verification_token.check_token(user, token)
    assert not password_reset_token.check_token(user, token)


# --- uid -------------------------------------------------------------------


@pytest.mark.django_db
def test_uid_round_trips_to_the_user(user):
    assert user_from_uid(encode_uid(user)) == user


@pytest.mark.django_db
@pytest.mark.parametrize(
    "uid",
    [
        None,
        42,
        ["MQ"],
        "",
        "!!!not-base64!!!",
        urlsafe_base64_encode(b"not-a-number"),
        urlsafe_base64_encode(b"\xff\xfe"),
        urlsafe_base64_encode(force_bytes(10**30)),
    ],
)
def test_a_broken_uid_points_at_nobody(user, uid):
    assert user_from_uid(uid) is None


@pytest.mark.django_db
def test_an_unknown_uid_points_at_nobody(user):
    assert user_from_uid(urlsafe_base64_encode(force_bytes(user.pk + 1000))) is None


@pytest.mark.django_db
def test_a_deactivated_account_is_out_of_reach(user):
    user.is_active = False
    user.save(update_fields=["is_active"])

    assert user_from_uid(encode_uid(user)) is None
