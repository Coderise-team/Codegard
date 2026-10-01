"""Acceptance rate counts only checked submissions.

A submission without a verdict has not been judged yet, so it is neither a
success nor a failure. The same rate is served by three endpoints — the catalog,
the daily problem and the recommendations — and all three must agree.
"""

import pytest
from apps.problems.models import DailyProblem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from factories import make_problem, make_submission

# api_client, user, other and user_client come from the project-wide conftest.

CATALOG_URL = reverse("problems-list")
DAILY_URL = reverse("problems-daily")
RECOMMENDATIONS_URL = reverse("problems-recommended")


def _catalog_acceptance(client, problem):
    rows = client.get(CATALOG_URL).json()["results"]
    return next(row["acceptance"] for row in rows if row["id"] == problem.id)


def _daily_acceptance(client, problem):
    data = client.get(DAILY_URL).json()
    return data["acceptance"]


def _recommendations_acceptance(client, problem):
    rows = client.get(RECOMMENDATIONS_URL).json()
    return next(row["acceptance"] for row in rows if row["id"] == problem.id)


@pytest.mark.django_db
def test_catalog_ignores_unchecked_submissions(user_client, other):
    problem = make_problem("Two Sum")

    make_submission(other, problem, verdict=Submission.Verdict.AC)
    make_submission(other, problem, verdict=Submission.Verdict.WA)
    make_submission(other, problem, verdict=None)

    assert _catalog_acceptance(user_client, problem) == 50.0


@pytest.mark.django_db
def test_catalog_without_verdict_submissions(user_client, other):
    problem = make_problem("Two Sum")

    make_submission(other, problem, verdict=None)
    make_submission(other, problem, verdict=None)

    assert _catalog_acceptance(user_client, problem) == 0


@pytest.mark.django_db
def test_catalog_without_submissions(user_client):
    problem = make_problem("Two Sum")

    assert _catalog_acceptance(user_client, problem) == 0


@pytest.mark.django_db
def test_catalog_same_number_all_places(user_client, other):
    problem = make_problem("Two Sum")

    DailyProblem.objects.create(date=timezone.now().date(), problem=problem)

    make_submission(other, problem, verdict=Submission.Verdict.AC)
    make_submission(other, problem, verdict=Submission.Verdict.WA)
    make_submission(other, problem, verdict=None)

    assert _catalog_acceptance(user_client, problem) == 50
    assert _daily_acceptance(user_client, problem) == 50
    assert _recommendations_acceptance(user_client, problem) == 50
