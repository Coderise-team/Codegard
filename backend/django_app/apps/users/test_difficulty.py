"""

Tests for the difficulty breakdown endpoint: GET /api/users/{username}/difficulty/.

"""

import pytest
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
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
def test_total_counts_all_problems_per_difficulty(client, user):
    _problem("easy", "e1")
    _problem("easy", "e2")
    _problem("medium", "m1")
    # no hard problems
    body = client.get(reverse("users:user-difficulty", args=[user.username])).json()
    assert body["easy"]["total"] == 2
    assert body["medium"]["total"] == 1
    assert body["hard"]["total"] == 0


@pytest.mark.django_db
def test_solved_counts_distinct_ac_per_difficulty(client, user):
    e1, e2 = _problem("easy", "e1"), _problem("easy", "e2")
    m1 = _problem("medium", "m1")
    _problem("hard", "h1")  # exists but untouched

    _sub(user, e1, Submission.Verdict.AC)
    _sub(user, e1, Submission.Verdict.AC)  # same problem twice -> counts once
    _sub(user, e2, Submission.Verdict.AC)  # -> easy solved == 2
    _sub(user, m1, Submission.Verdict.WA)  # WA -> not solved

    body = client.get(reverse("users:user-difficulty", args=[user.username])).json()
    assert body["easy"]["solved"] == 2
    assert body["medium"]["solved"] == 0
    assert body["hard"]["solved"] == 0


@pytest.mark.django_db
def test_empty_gives_all_zeros_with_all_keys(client, user):
    body = client.get(reverse("users:user-difficulty", args=[user.username])).json()
    assert body == {
        "easy": {"solved": 0, "total": 0},
        "medium": {"solved": 0, "total": 0},
        "hard": {"solved": 0, "total": 0},
    }


@pytest.mark.django_db
def test_sees_other_users_breakdown(client, user):
    # `client` is `viewer`; it requests `user`'s breakdown and sees their solves.
    p = _problem("easy", "e1")
    _sub(user, p, Submission.Verdict.AC)
    body = client.get(reverse("users:user-difficulty", args=[user.username])).json()
    assert body["easy"]["solved"] == 1


@pytest.mark.django_db
def test_nonexistent_user_returns_404(client):
    resp = client.get(reverse("users:user-difficulty", args=["no-such-user"]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_requires_authentication(user):
    resp = APIClient().get(reverse("users:user-difficulty", args=[user.username]))
    assert resp.status_code in (401, 403)
