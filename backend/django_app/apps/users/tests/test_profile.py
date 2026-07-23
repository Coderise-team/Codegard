"""
Profile tests: the user stats endpoint (GET /api/users/{username}/stats/) and
the `joined` field on the user detail endpoint.
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from factories import make_problem, make_submission
from rest_framework.test import APIClient

# --- user stats endpoint ---


@pytest.mark.django_db
def test_solved_counts_distinct_ac_problems(viewer_client, user):
    p1, p2 = make_problem("A"), make_problem("B")
    make_submission(user, p1, verdict=Submission.Verdict.AC)
    make_submission(
        user, p1, verdict=Submission.Verdict.AC
    )  # той самий problem -> рахується як один
    make_submission(user, p2, verdict=Submission.Verdict.WA)  # не AC -> не solved
    body = viewer_client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body["solved"] == 1


@pytest.mark.django_db
def test_contests_counts_participations(viewer_client, user):
    contest = Contest.objects.create(
        title="C",
        start_time=timezone.now(),
        end_time=timezone.now() + timedelta(hours=2),
    )
    contest.participants.add(user)
    body = viewer_client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body["contests"] == 1


@pytest.mark.django_db
def test_acceptance_is_ac_over_total_percent(viewer_client, user):
    p = make_problem()
    make_submission(user, p, verdict=Submission.Verdict.AC)
    make_submission(user, p, verdict=Submission.Verdict.AC)
    make_submission(user, p, verdict=Submission.Verdict.WA)
    make_submission(user, p, verdict=Submission.Verdict.TLE)
    # 2 AC з 4 усіх -> 50
    body = viewer_client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body["acceptance"] == 50


@pytest.mark.django_db
def test_zero_submissions_gives_zeros(viewer_client, user):
    body = viewer_client.get(reverse("users:user-stats", args=[user.username])).json()
    assert body == {"solved": 0, "contests": 0, "acceptance": 0}


@pytest.mark.django_db
def test_nonexistent_user_returns_404(viewer_client):
    resp = viewer_client.get(reverse("users:user-stats", args=["no-such-user"]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_requires_authentication(user):
    resp = APIClient().get(reverse("users:user-stats", args=[user.username]))
    assert resp.status_code in (401, 403)


# --- `joined` field on the user detail endpoint ---


@pytest.mark.django_db
def test_joined_returns_registration_date(viewer_client, django_user_model):
    user = django_user_model.objects.create_user(
        username="j", email="j@test.com", password="pass"
    )
    body = viewer_client.get(reverse("users:user-detail", args=[user.username])).json()
    assert body["joined"][:10] == user.date_joined.date().isoformat()
