"""
Project-wide test fixtures.

Only universal fixtures live here — an API client, a plain user, a superuser,
an authenticated client, and a fake Redis. Domain fixtures (problems, contests,
submissions, ...) belong in each app's ``tests/conftest.py``.

An app-local fixture with the same name shadows the one defined here, so a test
that needs a specific username or a richer object just overrides it locally.

No ``admin_client`` here on purpose: pytest-django ships one (a session-auth
Django client for /admin/ tests). Shadowing it globally breaks admin tests, so
API tests that want a DRF admin client define their own locally.
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
def auth_client(api_client, user):
    """API client authenticated as ``user``."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def redis():
    """In-memory Redis matching the real client's ``decode_responses=True``."""
    return FakeStrictRedis(decode_responses=True)
