"""Tests for the daily-challenge endpoint GET /api/problems/daily/."""

from datetime import timedelta

import pytest
from apps.problems.models import DailyProblem, Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="user", email="user@test.com", password="pass"
    )


@pytest.fixture
def other(db, django_user_model):
    return django_user_model.objects.create_user(
        username="other", email="other@test.com", password="pass"
    )


@pytest.fixture
def admin(db, django_user_model):
    return django_user_model.objects.create_superuser(
        username="admin", email="admin@test.com", password="pass"
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Two Sum",
        description="desc",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


DAILY_URL = reverse("problems-daily")


def _ac(user, problem, when):
    s = Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=Submission.Verdict.AC,
    )
    Submission.objects.filter(pk=s.pk).update(created_at=when)
    return s


@pytest.mark.django_db
def test_anonymous_gets_401(api_client):
    assert api_client.get(DAILY_URL).status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_no_daily_today_returns_null_200(auth_client):
    resp = auth_client.get(DAILY_URL)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() is None


@pytest.mark.django_db
def test_shape_and_keys(auth_client, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    resp = auth_client.get(DAILY_URL)
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert set(body.keys()) == {
        "id",
        "title",
        "difficulty",
        "tags",
        "acceptance",
        "solved_today",
    }
    assert body["id"] == problem.id
    assert body["solved_today"] is False


@pytest.mark.django_db
def test_solved_today_true_after_ac_today(auth_client, user, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    _ac(user, problem, timezone.now())
    assert auth_client.get(DAILY_URL).json()["solved_today"] is True


@pytest.mark.django_db
def test_ac_yesterday_does_not_count(auth_client, user, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    _ac(user, problem, timezone.now() - timedelta(days=1))
    assert auth_client.get(DAILY_URL).json()["solved_today"] is False


@pytest.mark.django_db
def test_other_users_ac_does_not_count(auth_client, other, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    _ac(other, problem, timezone.now())
    assert auth_client.get(DAILY_URL).json()["solved_today"] is False


@pytest.mark.django_db
def test_delete_daily_problem_returns_409(api_client, admin, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    api_client.force_authenticate(user=admin)
    resp = api_client.delete(reverse("problems-detail", args=[problem.id]))
    assert resp.status_code == status.HTTP_409_CONFLICT
    assert Problem.objects.filter(pk=problem.id).exists()


@pytest.mark.django_db
def test_delete_never_daily_problem_returns_204(api_client, admin, problem):
    api_client.force_authenticate(user=admin)
    resp = api_client.delete(reverse("problems-detail", args=[problem.id]))
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    assert not Problem.objects.filter(pk=problem.id).exists()
