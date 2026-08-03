"""Tests for the Recommended problems endpoint."""

from collections import Counter

import pytest
from apps.problems.models import Tag
from apps.submissions.models import Submission
from django.urls import reverse
from factories import make_problem, make_submission
from rest_framework.test import APIClient

# user and user_client come from conftest; APIClient is used directly for the
# unauthenticated case below.


def _make(n, difficulty):
    return [make_problem(f"{difficulty}-{i}", difficulty=difficulty) for i in range(n)]


@pytest.mark.django_db
def test_requires_authentication():
    resp = APIClient().get(reverse("problems-recommended"))
    assert resp.status_code == 401


@pytest.mark.django_db
def test_excludes_solved_problems(user_client, user):
    solved = make_problem("solved", difficulty="easy")
    make_submission(user, solved, verdict=Submission.Verdict.AC)
    unsolved = make_problem("unsolved", difficulty="easy")

    ids = [p["id"] for p in user_client.get(reverse("problems-recommended")).json()]
    assert solved.id not in ids
    assert unsolved.id in ids


@pytest.mark.django_db
def test_attempted_but_failed_is_still_recommended(user_client, user):
    p = make_problem("tried", difficulty="easy")
    make_submission(user, p, verdict=Submission.Verdict.WA)

    ids = [x["id"] for x in user_client.get(reverse("problems-recommended")).json()]
    assert p.id in ids


@pytest.mark.django_db
def test_two_per_difficulty_when_enough(user_client):
    _make(3, "easy")
    _make(3, "medium")
    _make(3, "hard")

    body = user_client.get(reverse("problems-recommended")).json()
    assert len(body) == 6
    counts = Counter(p["difficulty"] for p in body)
    assert counts["easy"] == 2
    assert counts["medium"] == 2
    assert counts["hard"] == 2


@pytest.mark.django_db
def test_backfills_to_six_when_a_difficulty_is_short(user_client):
    _make(1, "easy")
    _make(3, "medium")
    _make(3, "hard")

    body = user_client.get(reverse("problems-recommended")).json()
    assert len(body) == 6


@pytest.mark.django_db
def test_returns_fewer_when_not_enough_unsolved(user_client):
    _make(2, "easy")

    body = user_client.get(reverse("problems-recommended")).json()
    assert len(body) == 2


@pytest.mark.django_db
def test_item_shape_has_tags_and_acceptance(user_client, django_user_model):
    # Submissions by another user give acceptance but keep the problem unsolved
    # for our viewer (acceptance is global, "solved" is per-user).
    other = django_user_model.objects.create_user(
        username="o", email="o@test.com", password="pass"
    )
    p = make_problem("shape", difficulty="easy")
    p.tags.add(Tag.objects.create(name="DP"), Tag.objects.create(name="Math"))
    make_submission(other, p, verdict=Submission.Verdict.AC)
    make_submission(other, p, verdict=Submission.Verdict.WA)

    body = user_client.get(reverse("problems-recommended")).json()
    item = next(x for x in body if x["id"] == p.id)
    assert set(item.keys()) == {"id", "title", "difficulty", "tags", "acceptance"}
    assert item["tags"] == ["DP", "Math"]
    assert item["acceptance"] == 50.0
    assert item["difficulty"] == "easy"


@pytest.mark.django_db
def test_ordered_easy_medium_hard(user_client):
    _make(2, "easy")
    _make(2, "medium")
    _make(2, "hard")

    difficulties = [
        p["difficulty"] for p in user_client.get(reverse("problems-recommended")).json()
    ]
    rank = {"easy": 0, "medium": 1, "hard": 2}
    assert difficulties == sorted(difficulties, key=lambda d: rank[d])
