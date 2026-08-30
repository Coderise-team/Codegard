"""The /healthz/ endpoint."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_healthz_reports_ok(api_client):
    resp = api_client.get(reverse("healthz"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["cache"] == "ok"


@pytest.mark.django_db
def test_healthz_needs_no_login(api_client):
    """Docker has no token — the check must answer an anonymous request."""
    assert api_client.get(reverse("healthz")).status_code == 200
