"""
Tests for the ELO-history endpoint: GET /api/users/{username}/elo-history/.
Returns a user's ELO ratings oldest-first (chronological) for a sparkline.
"""

from datetime import timedelta

import pytest
from apps.users.models import EloHistory
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient


@pytest.fixture
def client(db, django_user_model):
    viewer = django_user_model.objects.create_user(
        username="viewer", email="viewer@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=viewer)
    return api


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )


def _entry(user, rating, *, when=None):
    e = EloHistory.objects.create(user=user, rating=rating)
    if when is not None:
        EloHistory.objects.filter(pk=e.pk).update(created_at=when)
    return e


@pytest.mark.django_db
def test_returns_history_oldest_first(client, user):
    now = timezone.now()
    _entry(user, 1225, when=now - timedelta(days=1))
    _entry(user, 1210, when=now - timedelta(days=2))
    _entry(user, 1218, when=now)

    resp = client.get(reverse("users:user-elo-history", args=[user.username]))
    assert resp.status_code == 200
    data = resp.json()
    assert [row["rating"] for row in data] == [1210, 1225, 1218]
    assert set(data[0]) == {"rating", "created_at"}


@pytest.mark.django_db
def test_empty_for_user_without_history(client, user):
    resp = client.get(reverse("users:user-elo-history", args=[user.username]))
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.django_db
def test_only_target_users_history(client, user, django_user_model):
    other = django_user_model.objects.create_user(
        username="other", email="other@test.com", password="pass"
    )
    _entry(user, 1215)
    _entry(other, 1190)
    resp = client.get(reverse("users:user-elo-history", args=[user.username]))
    assert len(resp.json()) == 1
    assert resp.json()[0]["rating"] == 1215


@pytest.mark.django_db
def test_nonexistent_user_returns_404(client):
    resp = client.get(reverse("users:user-elo-history", args=["missing-user"]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_requires_authentication(user):
    resp = APIClient().get(reverse("users:user-elo-history", args=[user.username]))
    assert resp.status_code in (401, 403)
