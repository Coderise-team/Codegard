"""Tests for the problems API: list/filter, retrieve, CRUD, and acceptance rate."""

import pytest
from apps.problems.models import Problem, TestCase
from apps.submissions.models import Submission
from django.urls import reverse
from rest_framework import status

# api_client, user, admin, user_client, custom_admin_client and problem come
# from conftest.


@pytest.fixture
def problem_with_test_cases(problem):
    TestCase.objects.create(
        problem=problem,
        input="1 2\n3",
        expected_output="0 1",
        is_hidden=False,
    )
    TestCase.objects.create(
        problem=problem,
        input="2 7 11 15\n9",
        expected_output="0 1",
        is_hidden=True,
    )
    return problem


# ---------------------------------------------------------------------------
# List & filter tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProblemList:
    def test_list_returns_200(self, api_client, problem):
        url = reverse("problems-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_list_contains_problem(self, api_client, problem):
        url = reverse("problems-list")
        response = api_client.get(url)
        results = response.data.get("results", response.data)
        titles = [p["title"] for p in results]
        assert problem.title in titles

    def test_filter_by_difficulty_easy(self, api_client, db):
        Problem.objects.create(
            title="Easy one",
            description="",
            difficulty="easy",
            time_limit=1000,
            memory_limit=256,
        )
        Problem.objects.create(
            title="Hard one",
            description="",
            difficulty="hard",
            time_limit=1000,
            memory_limit=256,
        )

        url = reverse("problems-list")
        response = api_client.get(url, {"difficulty": "easy"})

        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        for problem in results:
            assert problem["difficulty"] == "easy"

    def test_filter_by_difficulty_hard(self, api_client, db):
        Problem.objects.create(
            title="Hard one",
            description="",
            difficulty="hard",
            time_limit=1000,
            memory_limit=256,
        )

        url = reverse("problems-list")
        response = api_client.get(url, {"difficulty": "hard"})

        results = response.data.get("results", response.data)
        assert all(p["difficulty"] == "hard" for p in results)

    def test_invalid_difficulty_rejected(self, api_client, problem):
        # ChoiceFilter validates: an out-of-range difficulty is a 400 now
        # (used to be silently ignored before django-filter).
        url = reverse("problems-list")
        response = api_client.get(url, {"difficulty": "invalid"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Retrieve tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProblemRetrieve:
    def test_retrieve_returns_200(self, api_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == problem.title

    def test_user_sees_only_visible_test_cases(
        self, user_client, problem_with_test_cases
    ):
        url = reverse("problems-detail", args=[problem_with_test_cases.pk])
        response = user_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        # Only 1 visible test case
        assert len(response.data["test_cases"]) == 1

    def test_admin_sees_all_test_cases(self, custom_admin_client, problem_with_test_cases):
        url = reverse("problems-detail", args=[problem_with_test_cases.pk])
        response = custom_admin_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        # Both visible and hidden
        assert len(response.data["test_cases"]) == 2


# ---------------------------------------------------------------------------
# Create tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProblemCreate:
    def test_admin_can_create(self, custom_admin_client):
        url = reverse("problems-list")
        data = {
            "title": "New Problem",
            "description": "Some description",
            "input_format": "Input format",
            "output_format": "Output format",
            "constraints": "Constraints",
            "difficulty": "medium",
            "time_limit": 2000,
            "memory_limit": 512,
            "tags": ["Math"],
        }
        response = custom_admin_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert Problem.objects.filter(title="New Problem").exists()

    def test_admin_can_create_with_test_cases(self, custom_admin_client):
        url = reverse("problems-list")
        data = {
            "title": "Problem with tests",
            "description": "desc",
            "input_format": "Input format",
            "output_format": "Output format",
            "constraints": "Constraints",
            "difficulty": "easy",
            "time_limit": 1000,
            "memory_limit": 256,
            "test_cases": [
                {"input": "1 2", "expected_output": "3", "is_hidden": False},
                {"input": "5 5", "expected_output": "10", "is_hidden": True},
            ],
            "tags": ["Math"],
        }
        response = custom_admin_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        problem = Problem.objects.get(title="Problem with tests")
        assert problem.test_cases.count() == 2

    def test_regular_user_cannot_create(self, user_client):
        url = reverse("problems-list")
        data = {
            "title": "Hack",
            "description": "",
            "difficulty": "easy",
            "time_limit": 1000,
            "memory_limit": 256,
        }
        response = user_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_create(self, api_client):
        url = reverse("problems-list")
        data = {
            "title": "Hack",
            "description": "",
            "difficulty": "easy",
            "time_limit": 1000,
            "memory_limit": 256,
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ]


# ---------------------------------------------------------------------------
# Update tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProblemUpdate:
    def test_admin_can_update(self, custom_admin_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = custom_admin_client.patch(url, {"difficulty": "hard"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        problem.refresh_from_db()
        assert problem.difficulty == "hard"

    def test_regular_user_cannot_update(self, user_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = user_client.patch(url, {"difficulty": "hard"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Delete tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProblemDelete:
    def test_admin_can_delete(self, custom_admin_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = custom_admin_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Problem.objects.filter(pk=problem.pk).exists()

    def test_regular_user_cannot_delete(self, user_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = user_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Acceptance rate (AC / total submissions, annotated on the detail endpoint)
# ---------------------------------------------------------------------------


def _sub(user, problem, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


@pytest.mark.django_db
def test_acceptance_is_ac_over_total(user_client, user, problem):
    _sub(user, problem, Submission.Verdict.AC)
    _sub(user, problem, Submission.Verdict.AC)
    _sub(user, problem, Submission.Verdict.WA)
    _sub(user, problem, Submission.Verdict.TLE)
    body = user_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["acceptance"] == 50.0  # 2 AC of 4


@pytest.mark.django_db
def test_acceptance_rounded_to_one_decimal(user_client, user, problem):
    _sub(user, problem, Submission.Verdict.AC)
    _sub(user, problem, Submission.Verdict.WA)
    _sub(user, problem, Submission.Verdict.WA)
    body = user_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["acceptance"] == 33.3  # 1 of 3


@pytest.mark.django_db
def test_acceptance_zero_without_submissions(user_client, problem):
    body = user_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["acceptance"] == 0.0
