"""Shared helpers for the standings tests (plain functions, not fixtures)."""

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


def _user(username, elo, max_rating=None, is_active=True):
    """Create an active leaderboard user with a set rating."""
    return User.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="pass",
        elo_rating=elo,
        max_rating=max_rating if max_rating is not None else elo,
        is_active=is_active,
    )


def _auth(user):
    """APIClient authenticated as ``user``."""
    api = APIClient()
    api.force_authenticate(user=user)
    return api
