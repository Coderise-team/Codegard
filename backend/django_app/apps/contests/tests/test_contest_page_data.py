"""Tests for the contest-page data endpoints: the registrants list and the
client-controlled page_size on the contest history.
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

# --- fixtures & helpers ----------------------------------------------------


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )


@pytest.fixture
def client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _make_user(django_user_model, name, elo=1200):
    return django_user_model.objects.create_user(
        username=name, email=f"{name}@test.com", password="pass", elo_rating=elo
    )


def _contest(title="C", *, starts_in=-1, ends_in=1):
    """Contest whose start/end are `starts_in`/`ends_in` hours from now."""
    now = timezone.now()
    contest_status = (
        Contest.Status.PENDING
        if starts_in > 0
        else Contest.Status.ACTIVE
        if ends_in > 0
        else Contest.Status.FINISHED
    )
    return Contest.objects.create(
        title=title,
        start_time=now + timedelta(hours=starts_in),
        end_time=now + timedelta(hours=ends_in),
        status=contest_status,
    )


def _registrants_url(cid):
    return reverse("contests-registrants", args=[cid])


# --- Step 1: registrants ---------------------------------------------------


@pytest.mark.django_db
def test_registrants_unknown_contest_404(client):
    assert client.get(_registrants_url(999999)).status_code == 404


@pytest.mark.django_db
def test_registrants_only_this_contest(client, django_user_model):
    mine = _contest("Mine", starts_in=1, ends_in=3)
    theirs = _contest("Theirs", starts_in=1, ends_in=3)
    a = _make_user(django_user_model, "alice")
    b = _make_user(django_user_model, "bob")
    mine.participants.add(a)
    theirs.participants.add(b)

    names = [
        r["username"] for r in client.get(_registrants_url(mine.id)).json()["results"]
    ]
    assert names == ["alice"]  # bob is only in the other contest


@pytest.mark.django_db
def test_registrants_ordered_by_rating_then_id(client, django_user_model):
    c = _contest("C", starts_in=1, ends_in=3)
    low = _make_user(django_user_model, "low", elo=1500)
    high = _make_user(django_user_model, "high", elo=2500)
    # same rating -> deterministic by id (tie1 created before tie2)
    tie1 = _make_user(django_user_model, "tie1", elo=2000)
    tie2 = _make_user(django_user_model, "tie2", elo=2000)
    for u in (low, high, tie1, tie2):
        c.participants.add(u)

    rows = client.get(_registrants_url(c.id)).json()["results"]
    assert [r["username"] for r in rows] == ["high", "tie1", "tie2", "low"]
    assert rows[0] == {"username": "high", "elo_rating": 2500}


@pytest.mark.django_db
def test_registrants_pagination_10_per_page(client, django_user_model):
    c = _contest("C", starts_in=1, ends_in=3)
    for i in range(12):
        c.participants.add(_make_user(django_user_model, f"p{i:02d}", elo=1000 + i))

    page1 = client.get(_registrants_url(c.id)).json()
    assert page1["count"] == 12
    assert len(page1["results"]) == 10
    assert page1["next"] is not None

    page2 = client.get(_registrants_url(c.id), {"page": 2}).json()
    assert len(page2["results"]) == 2
    assert page2["next"] is None


@pytest.mark.django_db
def test_registrants_reflect_join_and_leave(client, user):
    c = _contest("C", starts_in=1, ends_in=3)  # pending -> join/leave allowed

    client.post(reverse("contests-join", args=[c.id]))
    names = [
        r["username"] for r in client.get(_registrants_url(c.id)).json()["results"]
    ]
    assert user.username in names

    client.post(reverse("contests-leave", args=[c.id]))
    names = [
        r["username"] for r in client.get(_registrants_url(c.id)).json()["results"]
    ]
    assert user.username not in names


# --- Step 5: page_size (history) -------------------------------------------


@pytest.mark.django_db
def test_history_page_size(client, user):
    for i in range(6):
        c = _contest(f"H{i}", starts_in=-(i + 3), ends_in=-(i + 1))
        ContestScore.objects.create(user=user, contest=c, solved_count=1)

    url = reverse("users:user-contest-history", args=[user.username])
    page1 = client.get(url, {"page_size": 5}).json()
    assert page1["count"] == 6
    assert len(page1["results"]) == 5
    assert page1["next"] is not None
    page2 = client.get(url, {"page_size": 5, "page": 2}).json()
    assert len(page2["results"]) == 1
