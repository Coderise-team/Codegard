"""Tests for the tags list endpoint: GET /api/problems/tags/."""

import pytest
from apps.problems.models import Problem, Tag
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


def _url():
    return reverse("problems-tags")


@pytest.mark.django_db
def test_returns_tags_with_counts(client):
    arrays = Tag.objects.create(name="Arrays")
    hashing = Tag.objects.create(name="Hashing")
    p1 = Problem.objects.create(title="A", description="", difficulty="easy")
    p2 = Problem.objects.create(title="B", description="", difficulty="easy")
    p1.tags.set([arrays, hashing])
    p2.tags.set([arrays])

    body = client.get(_url()).json()
    by_name = {row["name"]: row["count"] for row in body}
    assert by_name == {"Arrays": 2, "Hashing": 1}


@pytest.mark.django_db
def test_includes_zero_count_tags_sorted_by_name(client):
    Tag.objects.create(name="Zeta")
    Tag.objects.create(name="Alpha")
    body = client.get(_url()).json()
    assert [row["name"] for row in body] == ["Alpha", "Zeta"]
    assert all(row["count"] == 0 for row in body)


@pytest.mark.django_db
def test_public_access(client):
    # No auth — still 200 (read-only, like the problems list).
    assert client.get(_url()).status_code == 200
