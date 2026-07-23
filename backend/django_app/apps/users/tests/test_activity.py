"""
Tests for the activity-heatmap endpoint: GET /api/users/{id}/activity/.

Returns a sparse map of ISO date -> submission count for the last 365 days,
counting ALL submissions regardless of verdict.
"""

from datetime import timedelta

import pytest
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from factories import make_problem, make_submission
from rest_framework.test import APIClient


@pytest.fixture
def problem(db):
    return make_problem()


@pytest.mark.django_db
def test_counts_all_submissions_per_day_regardless_of_verdict(
    viewer_client, user, problem
):
    now = timezone.now()
    day1 = now - timedelta(days=2)
    day2 = now - timedelta(days=1)

    # day1: 3 submissions with mixed verdicts (all must count)
    make_submission(user, problem, verdict=Submission.Verdict.AC, created_at=day1)
    make_submission(user, problem, verdict=Submission.Verdict.WA, created_at=day1)
    make_submission(user, problem, verdict=None, created_at=day1)
    # day2: 1 submission
    make_submission(user, problem, verdict=Submission.Verdict.TLE, created_at=day2)

    url = reverse("users:user-activity", args=[user.username])
    resp = viewer_client.get(url)

    assert resp.status_code == 200
    assert resp.json() == {
        day1.date().isoformat(): 3,
        day2.date().isoformat(): 1,
    }


@pytest.mark.django_db
def test_sparse_no_empty_days(viewer_client, user, problem):
    """Only days with activity appear — no zero-filled gaps."""
    make_submission(user, problem, created_at=timezone.now() - timedelta(days=5))
    resp = viewer_client.get(reverse("users:user-activity", args=[user.username]))
    assert len(resp.json()) == 1


@pytest.mark.django_db
def test_excludes_submissions_older_than_window(viewer_client, user, problem):
    make_submission(user, problem, created_at=timezone.now() - timedelta(days=400))
    resp = viewer_client.get(reverse("users:user-activity", args=[user.username]))
    assert resp.json() == {}


@pytest.mark.django_db
def test_empty_for_user_without_submissions(viewer_client, user):
    resp = viewer_client.get(reverse("users:user-activity", args=[user.username]))
    assert resp.status_code == 200
    assert resp.json() == {}


@pytest.mark.django_db
def test_nonexistent_user_returns_404(viewer_client):
    resp = viewer_client.get(reverse("users:user-activity", args=["no-such_user"]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_requires_authentication(user):
    resp = APIClient().get(reverse("users:user-activity", args=[user.username]))
    assert resp.status_code in (401, 403)  # unauthenticated rejected


@pytest.mark.django_db
def test_only_target_users_submissions(viewer_client, user, problem, django_user_model):
    other = django_user_model.objects.create_user(
        username="other", email="other@test.com", password="pass"
    )
    make_submission(user, problem, created_at=timezone.now() - timedelta(days=1))
    make_submission(other, problem, created_at=timezone.now() - timedelta(days=1))

    resp = viewer_client.get(reverse("users:user-activity", args=[user.username]))
    assert sum(resp.json().values()) == 1  # only `user`'s submission counted


@pytest.mark.django_db
def test_same_day_different_times_grouped_as_one(viewer_client, user, problem):
    from datetime import timedelta

    day = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
    make_submission(user, problem, created_at=day)
    make_submission(user, problem, created_at=day + timedelta(hours=8))
    resp = viewer_client.get(reverse("users:user-activity", args=[user.username]))
    assert resp.json() == {day.date().isoformat(): 2}
