"""Trigram title search (?search=) and the id-tiebreaker pagination stability.

Covers the behaviours the search TZ calls out: exact title, a single word out of
a multi-word title, a one-letter typo, an unrelated word finding nothing, blank
?search= leaving the catalog untouched, the <3-char prefix fallback, composition
with ?difficulty=/?tag=, an explicit ?ordering= beating relevance, and stable
paging when every row shares a sort key.
"""

import pytest
from apps.problems.models import Problem
from django.urls import reverse
from factories import make_problem

LIST = reverse("problems-list")


def _titles(resp):
    rows = resp.data.get("results", resp.data)
    return [r["title"] for r in rows]


@pytest.mark.django_db
def test_exact_title_found(user_client):
    make_problem("Two Sum")
    make_problem("Valid Parentheses")
    assert "Two Sum" in _titles(user_client.get(LIST, {"search": "Two Sum"}))


@pytest.mark.django_db
def test_single_word_from_multiword_title_found(user_client):
    # Word similarity: one word out of a multi-word title still matches strongly.
    make_problem("Group Anagrams")
    make_problem("Valid Parentheses")
    assert _titles(user_client.get(LIST, {"search": "anagrams"})) == ["Group Anagrams"]


@pytest.mark.django_db
def test_one_letter_typo_found(user_client):
    make_problem("Group Anagrams")
    make_problem("Two Sum")
    assert "Group Anagrams" in _titles(user_client.get(LIST, {"search": "anagrms"}))


@pytest.mark.django_db
def test_unrelated_word_finds_nothing(user_client):
    make_problem("Group Anagrams")
    make_problem("Two Sum")
    assert _titles(user_client.get(LIST, {"search": "database"})) == []


@pytest.mark.django_db
def test_blank_search_returns_full_list(user_client):
    make_problem("Alpha")
    make_problem("Beta")
    assert len(_titles(user_client.get(LIST, {"search": ""}))) == 2


@pytest.mark.django_db
def test_filter_search_blank_term_is_noop():
    # django_filters strips whitespace and drops an empty value before calling,
    # so the method's own blank guard is only reachable in isolation. Verify it
    # returns the queryset untouched rather than filtering to nothing.
    from apps.problems.filters import ProblemFilter

    make_problem("Alpha")
    make_problem("Beta")
    qs = Problem.objects.all()
    assert ProblemFilter().filter_search(qs, "search", "   ").count() == 2


@pytest.mark.django_db
def test_two_char_query_is_prefix_match(user_client):
    make_problem("Two Sum")  # starts with "Tw"
    make_problem("Add Two Numbers")  # "Tw" only in the middle
    assert _titles(user_client.get(LIST, {"search": "Tw"})) == ["Two Sum"]


@pytest.mark.django_db
def test_search_composes_with_difficulty(user_client):
    make_problem("Binary Tree", difficulty=Problem.Difficulty.HARD)
    make_problem("Binary Search", difficulty=Problem.Difficulty.EASY)
    titles = _titles(user_client.get(LIST, {"search": "binary", "difficulty": "easy"}))
    assert titles == ["Binary Search"]


@pytest.mark.django_db
def test_search_composes_with_tag(user_client):
    make_problem("Binary Tree", tags=["Trees"])
    make_problem("Binary Search", tags=["Search"])
    titles = _titles(user_client.get(LIST, {"search": "binary", "tag": "Trees"}))
    assert titles == ["Binary Tree"]


@pytest.mark.django_db
def test_explicit_ordering_beats_similarity(user_client):
    # ?ordering=name must sort alphabetically even while a search is active.
    make_problem("Binary Zebra")
    make_problem("Binary Apple")
    titles = _titles(user_client.get(LIST, {"search": "binary", "ordering": "name"}))
    assert titles == ["Binary Apple", "Binary Zebra"]


@pytest.mark.django_db
def test_id_tiebreaker_keeps_pages_stable(user_client):
    # Every row shares the same difficulty, so ?ordering=difficulty leaves them
    # tied — only the appended `id` makes the order total. With the default page
    # size of 20, 25 rows span two pages: they must not drop or duplicate a row
    # at the seam, and the same page must repeat identically.
    for i in range(25):
        make_problem(f"P{i:02d}", difficulty=Problem.Difficulty.EASY)

    def page_ids(page):
        resp = user_client.get(LIST, {"ordering": "difficulty", "page": page})
        return [r["id"] for r in resp.data["results"]]

    page1, page2 = page_ids(1), page_ids(2)
    assert len(page1) == 20 and len(page2) == 5
    assert set(page1).isdisjoint(page2)  # no dupes / no gaps at the seam
    assert page1 == page_ids(1)  # same page twice, same order
