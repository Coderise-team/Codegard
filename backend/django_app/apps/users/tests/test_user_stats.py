"""Tests for the user stats endpoint: GET /api/users/{username}/stats/."""

from datetime import timedelta

import pytest
from apps.contests.models import Contest
from apps.problems.models import Problem
from apps.submissions.models import Submission
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


def _problem(title="P"):
    return Problem.objects.create(
        title=title, description="", difficulty=Problem.Difficulty.EASY
    )


def _sub(user, problem, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


@pytest.mark.django_db
def test_solved_counts_distinct_ac_problems(client, user):
    p1, p2 = _problem("A"), _problem("B")
    _sub(user, p1, Submission.Verdict.AC)
    _sub(user, p1, Submission.Verdict.AC)  # той самий problem -> рахується як один
    _sub(user, p2, Submission.Verdict.WA)  # не AC -> не solved
    body = client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body["solved"] == 1


@pytest.mark.django_db
def test_contests_counts_participations(client, user):
    contest = Contest.objects.create(
        title="C",
        start_time=timezone.now(),
        end_time=timezone.now() + timedelta(hours=2),
    )
    contest.participants.add(user)
    body = client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body["contests"] == 1


@pytest.mark.django_db
def test_acceptance_is_ac_over_total_percent(client, user):
    p = _problem()
    _sub(user, p, Submission.Verdict.AC)
    _sub(user, p, Submission.Verdict.AC)
    _sub(user, p, Submission.Verdict.WA)
    _sub(user, p, Submission.Verdict.TLE)
    # 2 AC з 4 усіх -> 50
    body = client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body["acceptance"] == 50


@pytest.mark.django_db
def test_zero_submissions_gives_zeros(client, user):
    body = client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body == {"solved": 0, "contests": 0, "acceptance": 0}


@pytest.mark.django_db
def test_nonexistent_user_returns_404(client):
    resp = client.get(reverse("users:user-stats", args=["no-such-user"]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_requires_authentication(user):
    resp = APIClient().get(reverse("users:user-stats", args=[user.username]))
    assert resp.status_code in (401, 403)
