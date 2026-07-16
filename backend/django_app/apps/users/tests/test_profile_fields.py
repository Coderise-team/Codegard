"""Tests for the ProfileCard `joined` field."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def client(db, django_user_model):
    viewer = django_user_model.objects.create_user(
        username="viewer", email="viewer@test.com", password="pass"
    )
    api = APIClient()
    api.force_authenticate(user=viewer)
    return api


@pytest.mark.django_db
def test_joined_returns_registration_date(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="j", email="j@test.com", password="pass"
    )
    body = client.get(reverse("users:user-detail", args=[user.username])).json()
    assert body["joined"][:10] == user.date_joined.date().isoformat()
