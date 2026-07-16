"""
Rating tests: the pure ELO formula (compute_elo_deltas), the get_rank ELO->tier
mapping, the rating fields exposed on GET /api/users/{username}/ (rank,
maxRating, globalRank, nextTier), and the ELO-history endpoint.
"""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from apps.users.models import EloHistory
from apps.users.services import (
    K_FACTOR,
    EloParticipant,
    _ranks_above,
    compute_elo_deltas,
    get_rank,
)
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

_T1 = datetime(2026, 1, 1, 10, 0, tzinfo=dt_timezone.utc)
_T2 = datetime(2026, 1, 1, 11, 0, tzinfo=dt_timezone.utc)


# --- pure ELO formula (no DB) ---


def test_ranks_above_score_then_penalty_then_time_and_none():
    # higher score wins
    assert _ranks_above((200, 99, _T2), (100, 0, _T1)) is True
    # equal score → lower penalty wins
    assert _ranks_above((100, 5, _T2), (100, 9, _T1)) is True
    assert _ranks_above((100, 9, _T2), (100, 5, _T1)) is False
    # equal score & penalty → earlier last_ac_at wins
    assert _ranks_above((100, 5, _T1), (100, 5, _T2)) is True
    # identical key → not "above" (it's a draw)
    assert _ranks_above((100, 5, _T1), (100, 5, _T1)) is False
    # None (solved nothing) counts as worst
    assert _ranks_above((0, 0, None), (0, 0, _T1)) is False  # a has None → not above
    assert _ranks_above((0, 0, _T1), (0, 0, None)) is True  # b has None → a above


def _p(user_id, rating, score, penalty=0, last_ac_at=None):
    return EloParticipant(user_id, rating, (score, penalty, last_ac_at))


def test_equal_ratings_two_players_symmetric():
    # p1 beats p2, equal ratings → +16 / -16 (K * 0.5 / 1).
    deltas = compute_elo_deltas([_p(1, 1200, 100), _p(2, 1200, 0)])
    assert deltas[1] == 16
    assert deltas[2] == -16
    assert deltas[1] == -deltas[2]


def test_swing_bounded_by_k_two_players():
    deltas = compute_elo_deltas([_p(1, 1200, 100), _p(2, 1200, 0)])
    assert all(abs(d) <= K_FACTOR for d in deltas.values())


def test_swing_bounded_by_k_large_field():
    # 10 players, distinct scores (distinct ranks), all equal rating.
    field = [_p(i, 1200, score=100 - i) for i in range(10)]
    deltas = compute_elo_deltas(field)
    assert len(deltas) == 10
    assert all(abs(d) <= K_FACTOR for d in deltas.values())


def test_upset_beats_higher_gives_more_than_equal_pair():
    # Lower-rated (1000) beats higher-rated (1400).
    deltas = compute_elo_deltas([_p(1, 1000, 100), _p(2, 1400, 0)])
    equal_pair_win = 16  # from the symmetric case
    assert deltas[1] > equal_pair_win  # upset winner gains more


def test_draw_gives_half_and_zero_delta_at_equal_ratings():
    # Identical place key → draw; equal ratings → ~0 for both.
    deltas = compute_elo_deltas(
        [_p(1, 1200, 100, penalty=5), _p(2, 1200, 100, penalty=5)]
    )
    assert deltas[1] == 0
    assert deltas[2] == 0


def test_fewer_than_two_returns_empty():
    assert compute_elo_deltas([]) == {}
    assert compute_elo_deltas([_p(1, 1200, 100)]) == {}


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


# --- fixtures & helpers for the endpoint tests ---


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


# --- rank exposed in the user detail endpoint ---


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


# --- rating fields: maxRating, globalRank, nextTier ---


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


# --- ELO-history endpoint: GET /api/users/{username}/elo-history/ ---


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
