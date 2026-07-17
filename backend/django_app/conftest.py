"""
Project-wide test fixtures.

Only universal fixtures live here: an API client, a plain user, a superuser, a
user-authenticated client, a superuser-authenticated client, and a fake Redis.
Domain fixtures (problems, contests, submissions, ...) belong in each app's
``tests/conftest.py``.

An app-local fixture with the same name shadows the one defined here, so a test
that needs a specific username or a richer object just overrides it locally.

The superuser client is ``custom_admin_client``, not ``admin_client``: the latter
is a pytest-django builtin (a session-auth Django client for /admin/ tests), and
shadowing it would break those. ``custom_admin_client`` is a DRF client for
hitting the REST API as a superuser.
"""

import pytest
from fakeredis import FakeStrictRedis
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """Unauthenticated DRF client."""
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    """Plain user for tests that don't care about the exact username."""
    return django_user_model.objects.create_user(
        username="user", email="user@test.com", password="pass"
    )


@pytest.fixture
def admin(db, django_user_model):
    """Superuser for admin-only endpoints."""
    return django_user_model.objects.create_superuser(
        username="admin", email="admin@test.com", password="pass"
    )


@pytest.fixture
def user_client(api_client, user):
    """DRF client authenticated as a regular ``user``."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def custom_admin_client(api_client, admin):
    """DRF client authenticated as a superuser (for the REST API, not /admin/)."""
    api_client.force_authenticate(user=admin)
    return api_client


@pytest.fixture
def redis():
    """In-memory Redis matching the real client's ``decode_responses=True``."""
    return FakeStrictRedis(decode_responses=True)
