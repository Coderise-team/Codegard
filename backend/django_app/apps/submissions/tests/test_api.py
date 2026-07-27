"""Tests for the submissions API: create (incl. contest rules), list/retrieve
scoping, no update/delete, the verdict flags, the ?problem= filter and the
public per-username list.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from factories import make_contest, make_problem, make_submission
from rest_framework import status

# ---------------------------------------------------------------------------
# Fixtures (api_client, user, other, user_client, problem and active_contest
# come from conftest)
# ---------------------------------------------------------------------------


@pytest.fixture
def problem2(db):
    return make_problem("Reverse String")


@pytest.fixture
def finished_contest(db, problem):
    contest = make_contest("Finished Contest", starts_in=-3, ends_in=-1)
    contest.problems.add(problem)
    return contest


@pytest.fixture
def submission(db, user, problem):
    return make_submission(user, problem, verdict=None)


# ---------------------------------------------------------------------------
# Create tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubmissionCreate:
    @patch("apps.submissions.views.push_to_judge_queue", return_value=True)
    def test_create_submission_returns_201(self, mock_queue, user_client, problem):
        url = reverse("submissions-list")
        data = {
            "problem": problem.pk,
            "code": "print('hello')",
            "language": "python",
        }
        response = user_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert "id" in response.data
        assert response.data["verdict"] is None
        assert response.data["status"] == "queued"

    @patch("apps.submissions.views.push_to_judge_queue", return_value=True)
    def test_submission_pushed_to_queue(self, mock_queue, user_client, problem):
        url = reverse("submissions-list")
        data = {"problem": problem.pk, "code": "x=1", "language": "python"}
        user_client.post(url, data, format="json")
        mock_queue.assert_called_once()

    @patch("apps.submissions.views.push_to_judge_queue", return_value=False)
    def test_queue_error_still_returns_201(self, mock_queue, user_client, problem):
        url = reverse("submissions-list")
        data = {"problem": problem.pk, "code": "x=1", "language": "python"}
        response = user_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == "queue_error"

    def test_unauthenticated_cannot_submit(self, api_client, problem):
        url = reverse("submissions-list")
        data = {"problem": problem.pk, "code": "x=1", "language": "python"}
        response = api_client.post(url, data, format="json")
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ]

    @patch("apps.submissions.views.push_to_judge_queue", return_value=True)
    def test_submit_with_active_contest(
        self, mock_queue, user_client, problem, active_contest
    ):
        url = reverse("submissions-list")
        data = {
            "problem": problem.pk,
            "contest": active_contest.pk,
            "code": "x=1",
            "language": "python",
        }
        response = user_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED

    def test_submit_with_finished_contest_returns_400(
        self, user_client, problem, finished_contest
    ):
        url = reverse("submissions-list")
        data = {
            "problem": problem.pk,
            "contest": finished_contest.pk,
            "code": "x=1",
            "language": "python",
        }
        response = user_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_problem_not_in_contest_returns_400(
        self, user_client, problem2, active_contest
    ):
        # problem2 is never added to the contest.
        url = reverse("submissions-list")
        data = {
            "problem": problem2.pk,
            "contest": active_contest.pk,
            "code": "x=1",
            "language": "python",
        }
        response = user_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# List / retrieve tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubmissionList:
    def test_user_sees_own_submissions(self, user_client, submission):
        url = reverse("submissions-list")
        response = user_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["id"] == submission.pk

    def test_submission_includes_problem_title(self, user_client, submission):
        url = reverse("submissions-list")
        response = user_client.get(url)
        results = response.data.get("results", response.data)
        assert results[0]["problem_title"] == "Two Sum"

    def test_user_cannot_see_other_submissions(self, api_client, other, submission):
        api_client.force_authenticate(user=other)
        url = reverse("submissions-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert len(results) == 0

    def test_retrieve_own_submission(self, user_client, submission):
        url = reverse("submissions-detail", args=[submission.pk])
        response = user_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == submission.pk

    def test_retrieve_other_submission_returns_404(self, api_client, other, submission):
        api_client.force_authenticate(user=other)
        url = reverse("submissions-detail", args=[submission.pk])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# No update / delete tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubmissionNoMutate:
    def test_update_not_allowed(self, user_client, submission):
        url = reverse("submissions-detail", args=[submission.pk])
        response = user_client.patch(url, {"code": "hacked"}, format="json")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_delete_not_allowed(self, user_client, submission):
        url = reverse("submissions-detail", args=[submission.pk])
        response = user_client.delete(url)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


# ---------------------------------------------------------------------------
# Verdict tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubmissionVerdict:
    def test_verdict_is_null_on_create(self, submission):
        assert submission.verdict is None

    def test_is_pending_true_when_no_verdict(self, user_client, submission):
        url = reverse("submissions-detail", args=[submission.pk])
        response = user_client.get(url)
        assert response.data["is_pending"] is True

    def test_is_pending_false_after_verdict(self, user_client, submission):
        submission.verdict = Submission.Verdict.AC
        submission.save()
        url = reverse("submissions-detail", args=[submission.pk])
        response = user_client.get(url)
        assert response.data["is_pending"] is False


# ---------------------------------------------------------------------------
# ?problem= filter (own submissions, scoped to one problem)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSubmissionProblemFilter:
    def test_filters_by_problem(self, user_client, user, problem, problem2):
        mine = Submission.objects.create(
            user=user, problem=problem, code="x", language="python"
        )
        Submission.objects.create(
            user=user, problem=problem2, code="y", language="python"
        )
        url = reverse("submissions-list") + f"?problem={problem.pk}"
        response = user_client.get(url)
        results = response.data.get("results", response.data)
        assert [r["id"] for r in results] == [mine.pk]

    def test_non_numeric_problem_is_ignored(self, user_client, user, problem):
        Submission.objects.create(
            user=user, problem=problem, code="x", language="python"
        )
        response = user_client.get(reverse("submissions-list") + "?problem=abc")
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert len(results) == 1


# ---------------------------------------------------------------------------
# Public submissions by username (ProfilePage RecentSubmissions)
# ---------------------------------------------------------------------------


def _user_subs_url(username):
    return reverse("users:user-submissions", args=[username])


@pytest.mark.django_db
class TestPublicSubmissions:
    def test_requires_auth(self, api_client, user):
        resp = api_client.get(_user_subs_url(user.username))
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_unknown_username_404(self, user_client):
        assert (
            user_client.get(_user_subs_url("ghost")).status_code
            == status.HTTP_404_NOT_FOUND
        )

    def test_any_authenticated_sees_others_submissions(
        self, user_client, other, problem
    ):
        s = Submission.objects.create(
            user=other, problem=problem, code="x", language="python"
        )
        data = user_client.get(_user_subs_url(other.username)).json()
        assert [row["id"] for row in data["results"]] == [s.pk]

    def test_newest_first(self, user_client, user, problem):
        old = Submission.objects.create(
            user=user, problem=problem, code="x", language="python"
        )
        new = Submission.objects.create(
            user=user, problem=problem, code="y", language="python"
        )
        # Pin `old` back so ordering is deterministic (created_at is auto_now_add).
        Submission.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(hours=1)
        )
        data = user_client.get(_user_subs_url(user.username)).json()
        assert [row["id"] for row in data["results"]] == [new.pk, old.pk]

    def test_code_is_not_exposed(self, user_client, other, problem):
        Submission.objects.create(
            user=other, problem=problem, code="secret_source", language="python"
        )
        row = user_client.get(_user_subs_url(other.username)).json()["results"][0]
        assert "code" not in row
        assert "stderr" not in row
        assert row["problem_title"] == "Two Sum"

    def test_paginated_default_and_page_size(self, user_client, user, problem):
        Submission.objects.bulk_create(
            Submission(user=user, problem=problem, code="x", language="python")
            for _ in range(25)
        )
        # Default page size is 20; count reflects the full set.
        data = user_client.get(_user_subs_url(user.username)).json()
        assert data["count"] == 25
        assert len(data["results"]) == 20
        # The dashboard block asks for a smaller page.
        page = user_client.get(
            _user_subs_url(user.username), {"page_size": 6}
        ).json()
        assert len(page["results"]) == 6


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_submission_str_includes_pending_and_verdict(submission):
    # Covers Submission.__str__ branches (Pending vs verdict code).
    assert "Pending" in str(submission)

    submission.verdict = Submission.Verdict.AC
    submission.save(update_fields=["verdict"])
    assert "AC" in str(submission)
