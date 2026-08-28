"""Tests for a submission being pulled into the round it belongs to.

The client sends the contest, so it cannot be trusted with it: a participant
who submits outside the round would collect verdicts with no penalty and paste
the answer back in.
"""

from unittest.mock import patch

import pytest
from apps.submissions.models import Submission
from django.urls import reverse
from factories import make_contest


def _submit(client, problem):
    """Post a solution the way a catalog page would: no contest at all."""
    return client.post(
        reverse("submissions-list"),
        {"problem": problem.pk, "code": "print(1)", "language": "python"},
        format="json",
    )


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_participant_of_a_running_round_submits_into_it(
    mock_queue, user_client, user, problem, active_contest
):
    active_contest.participants.add(user)

    resp = _submit(user_client, problem)

    assert resp.status_code == 201
    assert Submission.objects.get(pk=resp.data["id"]).contest_id == active_contest.pk


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_outsider_keeps_practising(mock_queue, user_client, problem, active_contest):
    # The round is running and holds the problem, but the user never joined.
    resp = _submit(user_client, problem)

    assert Submission.objects.get(pk=resp.data["id"]).contest_id is None


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_upsolving_after_the_round_stays_out_of_it(
    mock_queue, user_client, user, problem
):
    finished = make_contest("Done", starts_in=-3, ends_in=-1)
    finished.problems.add(problem)
    finished.participants.add(user)

    resp = _submit(user_client, problem)

    assert Submission.objects.get(pk=resp.data["id"]).contest_id is None
