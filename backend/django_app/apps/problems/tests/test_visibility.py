"""Tests for the catalog serving published problems only."""

import pytest
from django.urls import reverse
from factories import make_problem


@pytest.fixture
def published(db):
    return make_problem("Published")


@pytest.fixture
def hidden(db):
    return make_problem("Hidden", is_hidden=True)


def _titles(payload):
    rows = payload["results"] if isinstance(payload, dict) else payload
    return [row["title"] for row in rows]


# --- routes that hand back a list of problems ------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url_name, params, expected",
    [
        ("problems-list", {}, ["Published"]),
        ("problems-list", {"search": "Hidden"}, []),
        ("problems-recommended", {}, ["Published"]),
    ],
)
def test_hidden_problem_never_listed(
    user_client, published, hidden, url_name, params, expected
):
    payload = user_client.get(reverse(url_name), params).json()
    assert _titles(payload) == expected


# --- the single problem ----------------------------------------------------


@pytest.mark.django_db
def test_hidden_problem_has_no_page(user_client, hidden):
    # Knowing the address is not enough: this is the route the contest
    # workspace used to read statements from.
    resp = user_client.get(reverse("problems-detail", args=[hidden.pk]))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_published_problem_has_a_page(user_client, published):
    resp = user_client.get(reverse("problems-detail", args=[published.pk]))
    assert resp.status_code == 200


# --- tags ------------------------------------------------------------------


@pytest.mark.django_db
def test_tag_count_covers_published_problems_only(user_client):
    make_problem("Published", tags=["dp"])
    make_problem("Hidden", tags=["dp"], is_hidden=True)
    body = user_client.get(reverse("problems-tags")).json()
    assert {row["name"]: row["count"] for row in body} == {"dp": 1}


# --- staff -----------------------------------------------------------------


@pytest.mark.django_db
def test_staff_sees_hidden_problems(custom_admin_client, published, hidden):
    payload = custom_admin_client.get(reverse("problems-list")).json()
    assert sorted(_titles(payload)) == ["Hidden", "Published"]

    resp = custom_admin_client.get(reverse("problems-detail", args=[hidden.pk]))
    assert resp.status_code == 200
