"""Tests for ProfileCard fields: maxRating, globalRank, nextTier."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def client(db, django_user_model):
    viewer = django_user_model.objects.create_user(
        username="viewer", email="viewer@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=viewer)
    return api


@pytest.mark.django_db
def test_max_rating_present_and_matches_model(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )
    user.max_rating = 1750
    user.save(update_fields=["max_rating"])
    body = client.get(reverse("users:user-detail", args=[user.username])).json()
    assert body["maxRating"] == 1750


@pytest.mark.django_db
def test_global_rank_top_user_is_one(client, django_user_model):
    top = django_user_model.objects.create_user(
        username="top", email="top@test.com", password="pass", elo_rating=2500
    )
    django_user_model.objects.create_user(
        username="mid", email="mid@test.com", password="pass", elo_rating=1500
    )
    body = client.get(reverse("users:user-detail", args=[top.username])).json()
    assert body["globalRank"] == 1


@pytest.mark.django_db
def test_global_rank_ties_share_place(client, django_user_model):
    a = django_user_model.objects.create_user(
        username="a", email="a@test.com", password="pass", elo_rating=1800
    )
    b = django_user_model.objects.create_user(
        username="b", email="b@test.com", password="pass", elo_rating=1800
    )
    ra = client.get(reverse("users:user-detail", args=[a.username])).json()[
        "globalRank"
    ]
    rb = client.get(reverse("users:user-detail", args=[b.username])).json()[
        "globalRank"
    ]
    assert ra == rb == 1


@pytest.mark.django_db
def test_next_tier_middle(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="m", email="m@test.com", password="pass", elo_rating=1850
    )
    nt = client.get(reverse("users:user-detail", args=[user.username])).json()[
        "nextTier"
    ]
    assert nt == {"name": "Grandmaster", "floor": 1800, "ceil": 2000}


@pytest.mark.django_db
def test_next_tier_top_is_null(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="k", email="k@test.com", password="pass", elo_rating=2500
    )
    nt = client.get(reverse("users:user-detail", args=[user.username])).json()[
        "nextTier"
    ]
    assert nt is None


@pytest.mark.django_db
def test_joined_returns_registration_date(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="j", email="j@test.com", password="pass"
    )
    body = client.get(reverse("users:user-detail", args=[user.username])).json()
    assert body["joined"][:10] == user.date_joined.date().isoformat()
