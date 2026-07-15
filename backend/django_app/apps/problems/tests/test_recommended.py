"""Tests for the Recommended problems endpoint."""

from collections import Counter

import pytest
from apps.problems.models import Problem, Tag
from apps.submissions.models import Submission
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )


@pytest.fixture
def auth_client(db, user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _problem(title, difficulty):
    return Problem.objects.create(title=title, description="d", difficulty=difficulty)


def _make(n, difficulty):
    return [_problem(f"{difficulty}-{i}", difficulty) for i in range(n)]


def _sub(user, problem, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


@pytest.mark.django_db
def test_requires_authentication():
    resp = APIClient().get(reverse("problems-recommended"))
    assert resp.status_code == 401


@pytest.mark.django_db
def test_excludes_solved_problems(auth_client, user):
    solved = _problem("solved", "easy")
    _sub(user, solved, Submission.Verdict.AC)
    unsolved = _problem("unsolved", "easy")

    ids = [p["id"] for p in auth_client.get(reverse("problems-recommended")).json()]
    assert solved.id not in ids
    assert unsolved.id in ids


@pytest.mark.django_db
def test_attempted_but_failed_is_still_recommended(auth_client, user):
    p = _problem("tried", "easy")
    _sub(user, p, Submission.Verdict.WA)

    ids = [x["id"] for x in auth_client.get(reverse("problems-recommended")).json()]
    assert p.id in ids


@pytest.mark.django_db
def test_two_per_difficulty_when_enough(auth_client):
    _make(3, "easy")
    _make(3, "medium")
    _make(3, "hard")

    body = auth_client.get(reverse("problems-recommended")).json()
    assert len(body) == 6
    counts = Counter(p["difficulty"] for p in body)
    assert counts["easy"] == 2
    assert counts["medium"] == 2
    assert counts["hard"] == 2


@pytest.mark.django_db
def test_backfills_to_six_when_a_difficulty_is_short(auth_client):
    _make(1, "easy")
    _make(3, "medium")
    _make(3, "hard")

    body = auth_client.get(reverse("problems-recommended")).json()
    assert len(body) == 6


@pytest.mark.django_db
def test_returns_fewer_when_not_enough_unsolved(auth_client):
    _make(2, "easy")

    body = auth_client.get(reverse("problems-recommended")).json()
    assert len(body) == 2


@pytest.mark.django_db
def test_item_shape_has_tags_and_acceptance(auth_client, django_user_model):
    # Submissions by another user give acceptance but keep the problem unsolved
    # for our viewer (acceptance is global, "solved" is per-user).
    other = django_user_model.objects.create_user(
        username="o", email="o@test.com", password="pass"
    )
    p = _problem("shape", "easy")
    p.tags.add(Tag.objects.create(name="DP"), Tag.objects.create(name="Math"))
    _sub(other, p, Submission.Verdict.AC)
    _sub(other, p, Submission.Verdict.WA)

    body = auth_client.get(reverse("problems-recommended")).json()
    item = next(x for x in body if x["id"] == p.id)
    assert set(item.keys()) == {"id", "title", "difficulty", "tags", "acceptance"}
    assert item["tags"] == ["DP", "Math"]
    assert item["acceptance"] == 50.0
    assert item["difficulty"] == "easy"


@pytest.mark.django_db
def test_ordered_easy_medium_hard(auth_client):
    _make(2, "easy")
    _make(2, "medium")
    _make(2, "hard")

    difficulties = [
        p["difficulty"] for p in auth_client.get(reverse("problems-recommended")).json()
    ]
    rank = {"easy": 0, "medium": 1, "hard": 2}
    assert difficulties == sorted(difficulties, key=lambda d: rank[d])
