import pytest
from apps.problems.models import Problem, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="user", email="user@test.com", password="pass"
    )


@pytest.fixture
def admin(db, django_user_model):
    return django_user_model.objects.create_superuser(
        username="admin", email="admin@test.com", password="pass"
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_client(api_client, admin):
    api_client.force_authenticate(user=admin)
    return api_client


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Two Sum",
        description="Find two numbers that add up to target.",
        difficulty="easy",
        time_limit=1000,
        memory_limit=256,
    )


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

    def test_invalid_difficulty_returns_all(self, api_client, problem):
        url = reverse("problems-list")
        response = api_client.get(url, {"difficulty": "invalid"})
        assert response.status_code == status.HTTP_200_OK


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
        self, auth_client, problem_with_test_cases
    ):
        url = reverse("problems-detail", args=[problem_with_test_cases.pk])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        # Only 1 visible test case
        assert len(response.data["test_cases"]) == 1

    def test_admin_sees_all_test_cases(self, admin_client, problem_with_test_cases):
        url = reverse("problems-detail", args=[problem_with_test_cases.pk])
        response = admin_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        # Both visible and hidden
        assert len(response.data["test_cases"]) == 2


# ---------------------------------------------------------------------------
# Create tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProblemCreate:
    def test_admin_can_create(self, admin_client):
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
        response = admin_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert Problem.objects.filter(title="New Problem").exists()

    def test_admin_can_create_with_test_cases(self, admin_client):
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
        response = admin_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        problem = Problem.objects.get(title="Problem with tests")
        assert problem.test_cases.count() == 2

    def test_regular_user_cannot_create(self, auth_client):
        url = reverse("problems-list")
        data = {
            "title": "Hack",
            "description": "",
            "difficulty": "easy",
            "time_limit": 1000,
            "memory_limit": 256,
        }
        response = auth_client.post(url, data, format="json")
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
    def test_admin_can_update(self, admin_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = admin_client.patch(url, {"difficulty": "hard"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        problem.refresh_from_db()
        assert problem.difficulty == "hard"

    def test_regular_user_cannot_update(self, auth_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = auth_client.patch(url, {"difficulty": "hard"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Delete tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProblemDelete:
    def test_admin_can_delete(self, admin_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = admin_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Problem.objects.filter(pk=problem.pk).exists()

    def test_regular_user_cannot_delete(self, auth_client, problem):
        url = reverse("problems-detail", args=[problem.pk])
        response = auth_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
