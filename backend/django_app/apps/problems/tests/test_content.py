"""Tests for problem content fields (statement sections + example note)."""

import pytest
from apps.problems.models import Problem, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_client(db, django_user_model):
    admin = django_user_model.objects.create_superuser(
        username="admin", email="admin@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=admin)
    return api


@pytest.fixture
def user_client(db, django_user_model):
    user = django_user_model.objects.create_user(
        username="user", email="user@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _valid_payload(**overrides):
    """A full, valid create payload; tests drop/override pieces as needed."""
    data = {
        "title": "Two Sum",
        "description": "Find two numbers that add up to target.",
        "difficulty": "easy",
        "time_limit": 1000,
        "memory_limit": 256,
        "input_format": "First line: n. Second line: n integers.",
        "output_format": "Two indices.",
        "constraints": "2 <= n <= 1e5\n-1e9 <= a[i] <= 1e9",
        "tags": ["Arrays"],
    }
    data.update(overrides)
    return data


@pytest.mark.django_db
class TestContentFieldsRequired:
    def test_create_with_all_content_fields_succeeds(self, admin_client):
        resp = admin_client.post(
            reverse("problems-list"), _valid_payload(), format="json"
        )
        assert resp.status_code == status.HTTP_201_CREATED
        problem = Problem.objects.get(title="Two Sum")
        assert problem.input_format == "First line: n. Second line: n integers."
        assert problem.output_format == "Two indices."
        assert problem.constraints.startswith("2 <= n")

    @pytest.mark.parametrize(
        "missing", ["input_format", "output_format", "constraints"]
    )
    def test_create_without_a_content_field_is_400(self, admin_client, missing):
        payload = _valid_payload()
        payload.pop(missing)
        resp = admin_client.post(reverse("problems-list"), payload, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert missing in resp.data

    def test_create_with_blank_content_field_is_400(self, admin_client):
        resp = admin_client.post(
            reverse("problems-list"), _valid_payload(input_format=""), format="json"
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestContentFieldsReturned:
    def test_detail_returns_content_fields(self, api_client):
        problem = Problem.objects.create(
            title="P",
            description="body",
            difficulty="easy",
            input_format="in fmt",
            output_format="out fmt",
            constraints="1 <= n <= 10",
        )
        resp = api_client.get(reverse("problems-detail", args=[problem.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["input_format"] == "in fmt"
        assert resp.data["output_format"] == "out fmt"
        assert resp.data["constraints"] == "1 <= n <= 10"


@pytest.mark.django_db
class TestExampleNote:
    def test_visible_test_case_note_is_returned_to_user(self, user_client):
        problem = Problem.objects.create(title="P", description="b", difficulty="easy")
        TestCase.objects.create(
            problem=problem,
            input="1 2\n3",
            expected_output="0 1",
            is_hidden=False,
            note="indices are 0-based",
        )
        resp = user_client.get(reverse("problems-detail", args=[problem.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["test_cases"][0]["note"] == "indices are 0-based"

    def test_note_is_optional(self, user_client):
        problem = Problem.objects.create(title="P", description="b", difficulty="easy")
        TestCase.objects.create(
            problem=problem, input="x", expected_output="y", is_hidden=False
        )
        resp = user_client.get(reverse("problems-detail", args=[problem.pk]))
        assert resp.data["test_cases"][0]["note"] == ""


@pytest.mark.django_db
class TestLanguagesEndpoint:
    def test_languages_returns_python_with_template(self, api_client):
        resp = api_client.get(reverse("languages"))
        assert resp.status_code == status.HTTP_200_OK
        langs = {item["id"]: item for item in resp.data}
        assert "python" in langs
        assert langs["python"]["name"] == "Python"
        assert isinstance(langs["python"]["template"], str)
        assert langs["python"]["template"] != ""
