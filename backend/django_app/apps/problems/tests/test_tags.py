"""Tests for problem tags: the tags list endpoint (GET /api/problems/tags/),
tag serialization on the problem detail, and tag write rules on create/update.
"""

import pytest
from apps.problems.models import Problem, Tag
from django.urls import reverse

# ``api_client`` (anonymous), ``user_client``, ``custom_admin_client`` and
# ``problem`` come from conftest.


# ---- tags list endpoint: GET /api/problems/tags/ ----


def _tags_url():
    return reverse("problems-tags")


@pytest.mark.django_db
def test_returns_tags_with_counts(api_client):
    arrays = Tag.objects.create(name="Arrays")
    hashing = Tag.objects.create(name="Hashing")
    p1 = Problem.objects.create(title="A", description="", difficulty="easy")
    p2 = Problem.objects.create(title="B", description="", difficulty="easy")
    p1.tags.set([arrays, hashing])
    p2.tags.set([arrays])

    body = api_client.get(_tags_url()).json()
    by_name = {row["name"]: row["count"] for row in body}
    assert by_name == {"Arrays": 2, "Hashing": 1}


@pytest.mark.django_db
def test_includes_zero_count_tags_sorted_by_name(api_client):
    Tag.objects.create(name="Zeta")
    Tag.objects.create(name="Alpha")
    body = api_client.get(_tags_url()).json()
    assert [row["name"] for row in body] == ["Alpha", "Zeta"]
    assert all(row["count"] == 0 for row in body)


@pytest.mark.django_db
def test_public_access(api_client):
    # No auth — still 200 (read-only, like the problems list).
    assert api_client.get(_tags_url()).status_code == 200


# ---- tags on the problem detail: read ----


@pytest.mark.django_db
def test_tags_serialized_as_sorted_names(user_client, problem):
    problem.tags.add(Tag.objects.create(name="Math"), Tag.objects.create(name="DP"))
    body = user_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["tags"] == ["DP", "Math"]


@pytest.mark.django_db
def test_no_tags_is_empty_list(user_client, problem):
    body = user_client.get(reverse("problems-detail", args=[problem.pk])).json()
    assert body["tags"] == []


# ---- tags: write ----


@pytest.mark.django_db
def test_admin_create_with_tags(custom_admin_client):
    data = {
        "title": "Graph problem",
        "description": "d",
        "input_format": "Input format",
        "output_format": "Output format",
        "constraints": "Constraints",
        "difficulty": "medium",
        "tags": ["DP", "Graphs"],
    }
    resp = custom_admin_client.post(reverse("problems-list"), data, format="json")
    assert resp.status_code == 201
    created = Problem.objects.get(title="Graph problem")
    assert set(created.tags.values_list("name", flat=True)) == {"DP", "Graphs"}


@pytest.mark.django_db
def test_create_reuses_existing_tag(custom_admin_client):
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
    custom_admin_client.post(reverse("problems-list"), data, format="json")
    assert Tag.objects.filter(name="DP").count() == 1


@pytest.mark.django_db
def test_update_replaces_tags(custom_admin_client, problem):
    problem.tags.add(Tag.objects.create(name="Old"))
    url = reverse("problems-detail", args=[problem.pk])
    custom_admin_client.patch(url, {"tags": ["New"]}, format="json")
    assert list(problem.tags.values_list("name", flat=True)) == ["New"]


@pytest.mark.django_db
def test_create_without_tags_rejected(custom_admin_client):
    data = {
        "title": "No tags",
        "description": "d",
        "input_format": "Input format",
        "output_format": "Output format",
        "constraints": "Constraints",
        "difficulty": "easy",
    }
    resp = custom_admin_client.post(reverse("problems-list"), data, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_with_empty_tags_rejected(custom_admin_client):
    data = {
        "title": "Empty",
        "description": "d",
        "input_format": "Input format",
        "output_format": "Output format",
        "constraints": "Constraints",
        "difficulty": "easy",
        "tags": [],
    }
    resp = custom_admin_client.post(reverse("problems-list"), data, format="json")
    assert resp.status_code == 400
