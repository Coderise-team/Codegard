"""

Tests for the difficulty breakdown endpoint: GET /api/users/{username}/difficulty/.

"""

import pytest
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
from rest_framework.test import APIClient


def _problem(difficulty, title="P"):
    return Problem.objects.create(title=title, description="", difficulty=difficulty)


def _sub(user, problem, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


@pytest.mark.django_db
def test_total_counts_all_problems_per_difficulty(viewer_client, user):
    _problem("easy", "e1")
    _problem("easy", "e2")
    _problem("medium", "m1")
    # no hard problems
    body = viewer_client.get(
        reverse("users:user-difficulty", args=[user.username])
    ).json()
    assert body["easy"]["total"] == 2
    assert body["medium"]["total"] == 1
    assert body["hard"]["total"] == 0


@pytest.mark.django_db
def test_solved_counts_distinct_ac_per_difficulty(viewer_client, user):
    e1, e2 = _problem("easy", "e1"), _problem("easy", "e2")
    m1 = _problem("medium", "m1")
    _problem("hard", "h1")  # exists but untouched

    _sub(user, e1, Submission.Verdict.AC)
    _sub(user, e1, Submission.Verdict.AC)  # same problem twice -> counts once
    _sub(user, e2, Submission.Verdict.AC)  # -> easy solved == 2
    _sub(user, m1, Submission.Verdict.WA)  # WA -> not solved

    body = viewer_client.get(
        reverse("users:user-difficulty", args=[user.username])
    ).json()
    assert body["easy"]["solved"] == 2
    assert body["medium"]["solved"] == 0
    assert body["hard"]["solved"] == 0


@pytest.mark.django_db
def test_empty_gives_all_zeros_with_all_keys(viewer_client, user):
    body = viewer_client.get(
        reverse("users:user-difficulty", args=[user.username])
    ).json()
    assert body == {
        "easy": {"solved": 0, "total": 0},
        "medium": {"solved": 0, "total": 0},
        "hard": {"solved": 0, "total": 0},
    }


@pytest.mark.django_db
def test_sees_other_users_breakdown(viewer_client, user):
    # `viewer_client` is `viewer`; it requests `user`'s breakdown and sees their solves.
    p = _problem("easy", "e1")
    _sub(user, p, Submission.Verdict.AC)
    body = viewer_client.get(
        reverse("users:user-difficulty", args=[user.username])
    ).json()
    assert body["easy"]["solved"] == 1


@pytest.mark.django_db
def test_nonexistent_user_returns_404(viewer_client):
    resp = viewer_client.get(reverse("users:user-difficulty", args=["no-such-user"]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_requires_authentication(user):
    resp = APIClient().get(reverse("users:user-difficulty", args=[user.username]))
    assert resp.status_code in (401, 403)
