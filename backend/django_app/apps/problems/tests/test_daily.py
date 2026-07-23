"""Tests for the daily-challenge endpoint GET /api/problems/daily/."""

from datetime import timedelta

import pytest
from apps.problems.models import DailyProblem, Problem
from django.urls import reverse
from django.utils import timezone
from factories import make_submission
from rest_framework import status

# api_client, user, other, admin, user_client and problem come from conftest.

DAILY_URL = reverse("problems-daily")


@pytest.mark.django_db
def test_anonymous_gets_401(api_client):
    assert api_client.get(DAILY_URL).status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_no_daily_today_returns_null_200(user_client):
    resp = user_client.get(DAILY_URL)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() is None


@pytest.mark.django_db
def test_shape_and_keys(user_client, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    resp = user_client.get(DAILY_URL)
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
def test_solved_today_true_after_ac_today(user_client, user, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    make_submission(user, problem, created_at=timezone.now())
    assert user_client.get(DAILY_URL).json()["solved_today"] is True


@pytest.mark.django_db
def test_ac_yesterday_does_not_count(user_client, user, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    make_submission(user, problem, created_at=timezone.now() - timedelta(days=1))
    assert user_client.get(DAILY_URL).json()["solved_today"] is False


@pytest.mark.django_db
def test_other_users_ac_does_not_count(user_client, other, problem):
    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    make_submission(other, problem, created_at=timezone.now())
    assert user_client.get(DAILY_URL).json()["solved_today"] is False


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


# ---- DailyProblem.__str__ ----


@pytest.mark.django_db
def test_str(problem):
    dp = DailyProblem.objects.create(date=timezone.now().date(), problem=problem)
    assert str(dp) == f"{dp.date}: Two Sum"
