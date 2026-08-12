"""Trigram title search (?search=) on the contests hub.

The contest list is public read, so an unauthenticated client is enough. Covers a
typo-tolerant match and composition with the existing ?status= slice.
"""

import pytest
from django.urls import reverse
from factories import make_contest

LIST = reverse("contests-list")


def _titles(resp):
    rows = resp.data.get("results", resp.data)
    return [r["title"] for r in rows]


@pytest.mark.django_db
def test_typo_finds_contest(api_client):
    make_contest("Codeforces Round")
    make_contest("Weekly Challenge")
    assert "Codeforces Round" in _titles(api_client.get(LIST, {"search": "codefroces"}))


@pytest.mark.django_db
def test_unrelated_word_finds_nothing(api_client):
    make_contest("Codeforces Round")
    assert _titles(api_client.get(LIST, {"search": "database"})) == []


@pytest.mark.django_db
def test_search_composes_with_status(api_client):
    # status is recomputed from the clock on save, so pick the windows directly.
    make_contest("Alpha Cup", starts_in=-3, ends_in=-1)  # finished
    make_contest("Alpha Live", starts_in=-1, ends_in=1)  # active
    titles = _titles(api_client.get(LIST, {"search": "alpha", "status": "finished"}))
    assert titles == ["Alpha Cup"]
