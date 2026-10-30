"""Tests for revoke_refresh_tokens, the one way sessions are ended for good."""

import pytest
from apps.users.services import revoke_refresh_tokens
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

REFRESH = "users:token-refresh"


def _refresh_status(token: str) -> int:
    resp = APIClient().post(reverse(REFRESH), {"refresh": token}, format="json")
    return resp.status_code


@pytest.mark.django_db
def test_every_session_of_the_user_is_revoked(user):
    phone = str(RefreshToken.for_user(user))
    laptop = str(RefreshToken.for_user(user))

    revoke_refresh_tokens(user)

    assert _refresh_status(phone) == 401
    assert _refresh_status(laptop) == 401


@pytest.mark.django_db
def test_other_users_keep_their_sessions(user, other):
    theirs = str(RefreshToken.for_user(other))

    revoke_refresh_tokens(user)

    assert _refresh_status(theirs) == 200


@pytest.mark.django_db
def test_a_pair_minted_after_the_call_works(user):
    revoke_refresh_tokens(user)
    fresh = str(RefreshToken.for_user(user))

    assert _refresh_status(fresh) == 200


@pytest.mark.django_db
def test_revoking_twice_is_harmless(user):
    token = str(RefreshToken.for_user(user))

    revoke_refresh_tokens(user)
    revoke_refresh_tokens(user)

    assert _refresh_status(token) == 401
