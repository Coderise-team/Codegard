"""Shared fixtures for the users app tests."""

import pytest
from rest_framework.test import APIClient


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
