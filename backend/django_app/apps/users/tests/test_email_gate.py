"""Tests for what an unverified email blocks: submitting and joining contests.

Everything else stays open. Here the ``user`` fixture is unverified (see this
app's conftest); the verified path is what the submissions and contests suites
exercise.
"""

from unittest.mock import patch

import pytest
from apps.submissions.models import Submission
from django.urls import reverse
from factories import make_contest, make_problem
from rest_framework.test import APIClient

REFUSAL = {"code": "email_not_verified", "detail": "Confirm your email address first."}


def _verify(person):
    person.email_verified = True
    person.save(update_fields=["email_verified"])


def _submit(client, problem):
    return client.post(
        reverse("submissions-list"),
        {"problem": problem.pk, "code": "print(1)", "language": "python"},
        format="json",
    )


# --- submitting ------------------------------------------------------------


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_an_unverified_user_cannot_submit(queue, user, user_client):
    resp = _submit(user_client, make_problem())

    assert resp.status_code == 403
    assert resp.data == REFUSAL
    assert not Submission.objects.filter(user=user).exists()
    queue.assert_not_called()


@pytest.mark.django_db
@patch("apps.submissions.views.push_to_judge_queue", return_value=True)
def test_a_verified_user_submits(queue, user, user_client):
    _verify(user)

    resp = _submit(user_client, make_problem())

    assert resp.status_code == 201
    assert Submission.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_an_unverified_user_still_reads_their_submissions(user_client):
    assert user_client.get(reverse("submissions-list")).status_code == 200


@pytest.mark.django_db
def test_signed_out_submitting_is_still_a_401():
    """Not authenticated comes first; the email question is for users only."""
    assert _submit(APIClient(), make_problem()).status_code == 401


# --- joining a contest -----------------------------------------------------


@pytest.mark.django_db
def test_an_unverified_user_cannot_join_a_contest(user, user_client):
    contest = make_contest(starts_in=1, ends_in=3)

    resp = user_client.post(reverse("contests-join", args=[contest.pk]))

    assert resp.status_code == 403
    assert resp.data == REFUSAL
    assert not contest.participants.filter(pk=user.pk).exists()


@pytest.mark.django_db
def test_a_verified_user_joins_a_contest(user, user_client):
    _verify(user)
    contest = make_contest(starts_in=1, ends_in=3)

    resp = user_client.post(reverse("contests-join", args=[contest.pk]))

    assert resp.status_code == 200
    assert contest.participants.filter(pk=user.pk).exists()


@pytest.mark.django_db
def test_an_unverified_user_can_still_leave_and_look(user, user_client):
    """Registered before verification existed: leaving and reading stay open."""
    contest = make_contest(starts_in=1, ends_in=3)
    contest.participants.add(user)

    page = user_client.get(reverse("contests-detail", args=[contest.pk]))
    assert page.status_code == 200

    resp = user_client.post(reverse("contests-leave", args=[contest.pk]))
    assert resp.status_code == 200


@pytest.mark.django_db
def test_signed_out_joining_is_still_a_401():
    contest = make_contest(starts_in=1, ends_in=3)

    resp = APIClient().post(reverse("contests-join", args=[contest.pk]))

    assert resp.status_code == 401
