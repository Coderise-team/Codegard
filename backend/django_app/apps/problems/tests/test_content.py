"""Tests for problem content fields (statement sections + example note)."""

import pytest
from apps.problems.models import Problem, TestCase
from django.urls import reverse
from rest_framework import status

# api_client, user_client, custom_admin_client and problem_payload come from conftest.


@pytest.mark.django_db
class TestContentFieldsRequired:
    def test_create_with_all_content_fields_succeeds(
        self, custom_admin_client, problem_payload
    ):
        resp = custom_admin_client.post(
            reverse("problems-list"), problem_payload(), format="json"
        )
        assert resp.status_code == status.HTTP_201_CREATED
        problem = Problem.objects.get(title="Two Sum")
        assert problem.input_format == "First line: n. Second line: n integers."
        assert problem.output_format == "Two indices."
        assert problem.constraints.startswith("2 <= n")

    @pytest.mark.parametrize(
        "missing", ["input_format", "output_format", "constraints"]
    )
    def test_create_without_a_content_field_is_400(
        self, custom_admin_client, problem_payload, missing
    ):
        payload = problem_payload()
        payload.pop(missing)
        resp = custom_admin_client.post(
            reverse("problems-list"), payload, format="json"
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert missing in resp.data

    def test_create_with_blank_content_field_is_400(
        self, custom_admin_client, problem_payload
    ):
        resp = custom_admin_client.post(
            reverse("problems-list"),
            problem_payload(input_format=""),
            format="json",
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
            is_hidden=False,
        )
        resp = api_client.get(reverse("problems-detail", args=[problem.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["input_format"] == "in fmt"
        assert resp.data["output_format"] == "out fmt"
        assert resp.data["constraints"] == "1 <= n <= 10"


@pytest.mark.django_db
class TestExampleNote:
    def test_visible_test_case_note_is_returned_to_user(self, user_client):
        problem = Problem.objects.create(
            title="P", description="b", difficulty="easy", is_hidden=False
        )
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
        problem = Problem.objects.create(
            title="P", description="b", difficulty="easy", is_hidden=False
        )
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
