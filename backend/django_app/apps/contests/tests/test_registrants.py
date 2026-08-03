"""Tests for the contest registrants list: GET /api/contests/{id}/registrants/."""

import pytest
from django.urls import reverse
from factories import make_contest

# user and user_client come from conftest.


def _make_user(django_user_model, name, elo=1200):
    return django_user_model.objects.create_user(
        username=name, email=f"{name}@test.com", password="pass", elo_rating=elo
    )


def _pending_contest(title="C"):
    """Pending contest (starts in an hour), so join/leave are allowed."""
    return make_contest(title, starts_in=1, ends_in=3)


def _url(cid):
    return reverse("contests-registrants", args=[cid])


@pytest.mark.django_db
def test_unknown_contest_404(user_client):
    assert user_client.get(_url(999999)).status_code == 404


@pytest.mark.django_db
def test_only_this_contest(user_client, django_user_model):
    mine = _pending_contest("Mine")
    theirs = _pending_contest("Theirs")
    mine.participants.add(_make_user(django_user_model, "alice"))
    theirs.participants.add(_make_user(django_user_model, "bob"))

    names = [r["username"] for r in user_client.get(_url(mine.id)).json()["results"]]
    assert names == ["alice"]  # bob is only in the other contest


@pytest.mark.django_db
def test_ordered_by_rating_then_id(user_client, django_user_model):
    c = _pending_contest()
    low = _make_user(django_user_model, "low", elo=1500)
    high = _make_user(django_user_model, "high", elo=2500)
    # same rating -> deterministic by id (tie1 created before tie2)
    tie1 = _make_user(django_user_model, "tie1", elo=2000)
    tie2 = _make_user(django_user_model, "tie2", elo=2000)
    for u in (low, high, tie1, tie2):
        c.participants.add(u)

    rows = user_client.get(_url(c.id)).json()["results"]
    assert [r["username"] for r in rows] == ["high", "tie1", "tie2", "low"]
    assert rows[0] == {"username": "high", "elo_rating": 2500}


@pytest.mark.django_db
def test_pagination_10_per_page(user_client, django_user_model):
    c = _pending_contest()
    for i in range(12):
        c.participants.add(_make_user(django_user_model, f"p{i:02d}", elo=1000 + i))

    page1 = user_client.get(_url(c.id)).json()
    assert page1["count"] == 12
    assert len(page1["results"]) == 10
    assert page1["next"] is not None

    page2 = user_client.get(_url(c.id), {"page": 2}).json()
    assert len(page2["results"]) == 2
    assert page2["next"] is None


@pytest.mark.django_db
def test_reflects_join_and_leave(user_client, user):
    c = _pending_contest()

    user_client.post(reverse("contests-join", args=[c.id]))
    names = [r["username"] for r in user_client.get(_url(c.id)).json()["results"]]
    assert user.username in names

    user_client.post(reverse("contests-leave", args=[c.id]))
    names = [r["username"] for r in user_client.get(_url(c.id)).json()["results"]]
    assert user.username not in names
