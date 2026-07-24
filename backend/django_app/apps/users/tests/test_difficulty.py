"""

Tests for the difficulty breakdown endpoint: GET /api/users/{username}/difficulty/.

"""

import pytest
from apps.submissions.models import Submission
from django.urls import reverse
from factories import make_problem, make_submission
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_total_counts_all_problems_per_difficulty(viewer_client, user):
    make_problem("e1", difficulty="easy")
    make_problem("e2", difficulty="easy")
    make_problem("m1", difficulty="medium")
    # no hard problems
    body = viewer_client.get(
        reverse("users:user-difficulty", args=[user.username])
    ).json()
    assert body["easy"]["total"] == 2
    assert body["medium"]["total"] == 1
    assert body["hard"]["total"] == 0


@pytest.mark.django_db
def test_solved_counts_distinct_ac_per_difficulty(viewer_client, user):
    e1, e2 = (
        make_problem("e1", difficulty="easy"),
        make_problem("e2", difficulty="easy"),
    )
    m1 = make_problem("m1", difficulty="medium")
    make_problem("h1", difficulty="hard")  # exists but untouched

    make_submission(user, e1, verdict=Submission.Verdict.AC)
    make_submission(
        user, e1, verdict=Submission.Verdict.AC
    )  # same problem twice -> counts once
    make_submission(user, e2, verdict=Submission.Verdict.AC)  # -> easy solved == 2
    make_submission(user, m1, verdict=Submission.Verdict.WA)  # WA -> not solved

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
    p = make_problem("e1", difficulty="easy")
    make_submission(user, p, verdict=Submission.Verdict.AC)
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
