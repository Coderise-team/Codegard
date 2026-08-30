"""Trigram title search (?search=) on the contests hub.

The contest list is public read, so an unauthenticated client is enough. Covers a
typo-tolerant match, composition with the existing ?status= slice, and stable
paging when contests share a start_time.
"""

from datetime import timedelta

import pytest
from apps.contests.models import Contest
from django.urls import reverse
from django.utils import timezone
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
def test_two_char_query_is_prefix_match(api_client):
    # Under 3 chars there is no trigram signal, so it falls back to "starts with".
    make_contest("Codeforces Round")  # starts with "Co"
    make_contest("Weekly Challenge")  # "co" only in the middle
    assert _titles(api_client.get(LIST, {"search": "Co"})) == ["Codeforces Round"]


@pytest.mark.django_db
def test_search_composes_with_status(api_client):
    # status is recomputed from the clock on save, so pick the windows directly.
    make_contest("Alpha Cup", starts_in=-3, ends_in=-1)  # finished
    make_contest("Alpha Live", starts_in=-1, ends_in=1)  # active
    titles = _titles(api_client.get(LIST, {"search": "alpha", "status": "finished"}))
    assert titles == ["Alpha Cup"]


@pytest.mark.django_db
def test_id_tiebreaker_keeps_pages_stable(api_client):
    # All contests share one start_time, so -start_time alone leaves them tied —
    # only the appended `id` makes the order total. Two adjacent pages must not
    # drop or duplicate a contest, and the same page must repeat identically.
    for i in range(6):
        make_contest(f"Round {i:02d}", starts_in=-48, ends_in=-47)
    same = timezone.now() - timedelta(days=2)
    Contest.objects.update(start_time=same, end_time=same + timedelta(hours=1))

    def page_ids(page):
        resp = api_client.get(LIST, {"page_size": 3, "page": page})
        return [r["id"] for r in resp.data["results"]]

    page1, page2 = page_ids(1), page_ids(2)
    assert len(page1) == 3 and len(page2) == 3
    assert set(page1).isdisjoint(page2)  # no dupes / no gaps at the seam
    assert page1 == page_ids(1)  # same page twice, same order
