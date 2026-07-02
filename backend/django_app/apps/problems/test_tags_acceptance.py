"""Tests for Problem tags (M2M) and acceptance-rate annotation."""

import pytest
from apps.problems.models import Problem, Tag
from apps.submissions.models import Submission
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )


@pytest.fixture
def auth_client(db, user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def admin_client(db, django_user_model):
    admin = django_user_model.objects.create_superuser(
        username="admin", email="admin@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=admin)
    return api


@pytest.fixture
def problem(db):
    return Problem.objects.create(title="Two Sum", description="d", difficulty="easy")


def _sub(user, problem, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


# ---- tags: read ----


@pytest.mark.django_db
def test_tags_serialized_as_sorted_names(auth_client, problem):
    problem.tags.add(Tag.objects.create(name="Math"), Tag.objects.create(name="DP"))
    body = auth_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["tags"] == ["DP", "Math"]


@pytest.mark.django_db
def test_no_tags_is_empty_list(auth_client, problem):
    body = auth_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["tags"] == []


# ---- tags: write ----


@pytest.mark.django_db
def test_admin_create_with_tags(admin_client):
    data = {
        "title": "Graph problem",
        "description": "d",
        "input_format": "Input format",
        "output_format": "Output format",
        "constraints": "Constraints",
        "difficulty": "medium",
        "tags": ["DP", "Graphs"],
    }
    resp = admin_client.post(reverse("problems-list"), data, format="json")
    assert resp.status_code == 201
    created = Problem.objects.get(title="Graph problem")
    assert set(created.tags.values_list("name", flat=True)) == {"DP", "Graphs"}


@pytest.mark.django_db
def test_create_reuses_existing_tag(admin_client):
    Tag.objects.create(name="DP")
    data = {
        "title": "Another",
        "description": "d",
        "input_format": "Input format",
        "output_format": "Output format",
        "constraints": "Constraints",
        "difficulty": "easy",
        "tags": ["DP"],
    }
    admin_client.post(reverse("problems-list"), data, format="json")
    assert Tag.objects.filter(name="DP").count() == 1


@pytest.mark.django_db
def test_update_replaces_tags(admin_client, problem):
    problem.tags.add(Tag.objects.create(name="Old"))
    url = reverse("problems-detail", args=[problem.pk])
    admin_client.patch(url, {"tags": ["New"]}, format="json")
    assert list(problem.tags.values_list("name", flat=True)) == ["New"]


@pytest.mark.django_db
def test_create_without_tags_rejected(admin_client):
    data = {
        "title": "No tags",
        "description": "d",
        "input_format": "Input format",
        "output_format": "Output format",
        "constraints": "Constraints",
        "difficulty": "easy",
    }
    resp = admin_client.post(reverse("problems-list"), data, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_with_empty_tags_rejected(admin_client):
    data = {
        "title": "Empty",
        "description": "d",
        "input_format": "Input format",
        "output_format": "Output format",
        "constraints": "Constraints",
        "difficulty": "easy",
        "tags": [],
    }
    resp = admin_client.post(reverse("problems-list"), data, format="json")
    assert resp.status_code == 400


# ---- acceptance ----


@pytest.mark.django_db
def test_acceptance_is_ac_over_total(auth_client, user, problem):
    _sub(user, problem, Submission.Verdict.AC)
    _sub(user, problem, Submission.Verdict.AC)
    _sub(user, problem, Submission.Verdict.WA)
    _sub(user, problem, Submission.Verdict.TLE)
    body = auth_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["acceptance"] == 50.0  # 2 AC of 4


@pytest.mark.django_db
def test_acceptance_rounded_to_one_decimal(auth_client, user, problem):
    _sub(user, problem, Submission.Verdict.AC)
    _sub(user, problem, Submission.Verdict.WA)
    _sub(user, problem, Submission.Verdict.WA)
    body = auth_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["acceptance"] == 33.3  # 1 of 3


@pytest.mark.django_db
def test_acceptance_zero_without_submissions(auth_client, problem):
    body = auth_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["acceptance"] == 0.0
