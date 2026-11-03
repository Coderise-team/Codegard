"""Shared fixtures for the users app tests."""

import pytest
from rest_framework.test import APIClient


def _unverified(person):
    person.email_verified = False
    person.save(update_fields=["email_verified"])
    return person


@pytest.fixture
def user(user):
    """The project-wide ``user``, but with the address not yet verified.

    Elsewhere the conftest users come verified so that submitting and joining
    just work; this app tests verification itself, and a fresh sign-up — where
    every one of those tests starts — is unverified.
    """
    return _unverified(user)


@pytest.fixture
def other(other):
    """The project-wide ``other``, unverified like ``user`` above."""
    return _unverified(other)


@pytest.fixture
def auth_client():
    """Factory: return an APIClient authenticated as the given user."""

    def _auth(user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    return _auth


@pytest.fixture
def viewer_client(db, django_user_model):
    """
    APIClient authenticated as a separate viewer.

    Public profile endpoints (stats, activity, difficulty, rating, ...) let any
    authenticated user read another user's data, so tests act as a distinct
    viewer while the target is the plain ``user`` fixture.
    """
    viewer = django_user_model.objects.create_user(
        username="viewer", email="viewer@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=viewer)
    return api
