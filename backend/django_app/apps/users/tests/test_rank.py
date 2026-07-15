"""
Tests for the rank system: get_rank() ELO->rank mapping and the rank field
exposed in GET /api/users/{id}/.
"""

import pytest
from apps.users.services import get_rank
from django.urls import reverse
from rest_framework.test import APIClient

# --- get_rank() boundary mapping ---


@pytest.mark.parametrize(
    "elo,expected",
    [
        (0, "Trainee"),
        (1199, "Trainee"),
        (1200, "Junior"),  # lower bound inclusive
        (1399, "Junior"),
        (1400, "Specialist"),
        (1599, "Specialist"),
        (1600, "Expert"),
        (1800, "Master"),
        (2000, "Grandmaster"),
        (2200, "Architect"),
        (2399, "Architect"),
        (2400, "Kernel"),  # 2400+
        (5000, "Kernel"),
    ],
)
def test_get_rank_boundaries(elo, expected):
    assert get_rank(elo) == expected


def test_get_rank_negative_falls_back_to_trainee():
    assert get_rank(-100) == "Trainee"


# --- rank exposed in the user detail endpoint ---


@pytest.fixture
def client(db, django_user_model):
    viewer = django_user_model.objects.create_user(
        username="viewer", email="viewer@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=viewer)
    return api


@pytest.mark.django_db
def test_user_detail_includes_rank(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass", elo_rating=1850
    )
    resp = client.get(reverse("users:user-detail", args=[user.username]))
    assert resp.status_code == 200
    body = resp.json()
    assert body["elo_rating"] == 1850
    assert body["rank"] == "Master"  # 1800-2000


@pytest.mark.django_db
def test_user_detail_default_rating_is_junior(client, django_user_model):
    # Default elo_rating is 1200 -> Junior.
    user = django_user_model.objects.create_user(
        username="new", email="new@test.com", password="pass"
    )
    resp = client.get(reverse("users:user-detail", args=[user.username]))
    assert resp.json()["rank"] == "Junior"


@pytest.mark.django_db
def test_user_detail_404_for_unknown(client):
    resp = client.get(reverse("users:user-detail", args=["nope-no-such-user"]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_user_detail_requires_auth(django_user_model):
    user = django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )
    resp = APIClient().get(reverse("users:user-detail", args=[user.username]))
    assert resp.status_code in (401, 403)
