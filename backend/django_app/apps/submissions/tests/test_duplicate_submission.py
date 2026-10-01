"""Duplicate submission guard.

The same code on the same problem from the same user within the window is a
double click, not a new attempt: it is refused before a row is written or the
judge is called. Anything that differs — code, problem, user, or the time
window — is a genuine new submission.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from factories import make_problem
from rest_framework import status

# user, other, user_client and problem come from conftest.

SUBMIT_URL = reverse("submissions-list")


def _submit(client, problem, code="print(1)"):
    return client.post(
        SUBMIT_URL,
        {"problem": problem.pk, "code": code, "language": "python"},
        format="json",
    )


def _submit2(client, problem, code="print(1)", active_contest=None):
    data = {
        "problem": problem.pk,
        "code": code,
        "language": "python",
    }

    if active_contest is not None:
        data["contest"] = active_contest.pk

    return client.post(
        SUBMIT_URL,
        data,
        format="json",
    )


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_same_code_twice_is_refused_and_stored_once(mock_queue, user_client, problem):
    first = _submit(user_client, problem)
    second = _submit(user_client, problem)

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert Submission.objects.filter(problem=problem).count() == 1
    mock_queue.assert_called_once()


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_same_code_is_accepted_after_window(mock_queue, user_client, problem):
    first = _submit(user_client, problem)
    assert first.status_code == status.HTTP_201_CREATED

    Submission.objects.filter(problem=problem).update(
        created_at=timezone.now() - timedelta(seconds=31)
    )

    second = _submit(user_client, problem)
    assert second.status_code == status.HTTP_201_CREATED

    assert Submission.objects.filter(problem=problem).count() == 2


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_same_problem_accepted_immediately(mock_queue, user_client, problem):
    first = _submit(user_client, problem)
    second = _submit(user_client, problem, "print(2)")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_201_CREATED

    assert Submission.objects.filter(problem=problem).count() == 2


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_same_code_for_different_problem_accepted_immediately(mock_queue, user_client):
    first_problem = make_problem("Two Sum")
    second_problem = make_problem("Three Sum")

    first = _submit(user_client, first_problem)
    second = _submit(user_client, second_problem)

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_201_CREATED

    assert (
        Submission.objects.filter(problem__in=[first_problem, second_problem]).count()
        == 2
    )


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_same_code_from_another_user_is_accepted_immediately(
    mock_queue, user_client, api_client, other
):
    problem = make_problem("Two Sum")

    first = _submit(user_client, problem)
    assert first.status_code == status.HTTP_201_CREATED

    api_client.force_authenticate(other)

    second = _submit(api_client, problem)
    assert second.status_code == status.HTTP_201_CREATED
    assert Submission.objects.filter(problem=problem).count() == 2


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_code_differing_only_by_space_or_indentation(mock_queue, user_client, problem):
    first = _submit(user_client, problem, "print(1) ")
    second = _submit(user_client, problem, " print(2)")

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_201_CREATED
    assert Submission.objects.filter(problem=problem).count() == 2


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_contest_the_second_submission_doesnt_count_round(
    mock_queue, user_client, problem, active_contest
):
    first = _submit2(user_client, problem, active_contest=active_contest)
    second = _submit2(user_client, problem, active_contest=active_contest)

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_400_BAD_REQUEST
    assert Submission.objects.filter(contest=active_contest).count() == 1
    mock_queue.assert_called_once()
