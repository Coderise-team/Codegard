"""Trigram username search (?search=) on the standings endpoint.

The search filter is applied outside the annotation layer, so the ranks it
returns must stay global (the rank is a subquery the outer WHERE can't see) and
the envelope's `total`/`you` must be unaffected. Also covers a typo match and
composition with ?tier=.
"""

import pytest
from django.urls import reverse

from .helpers import _auth, _user

URL = "users:standings"


@pytest.mark.django_db
def test_typo_finds_username():
    me = _user("me", 1500)
    _user("petrenko", 1400)
    _user("ivanov", 1300)
    resp = _auth(me).get(reverse(URL), {"search": "petrnko"}).json()  # typo
    assert [r["username"] for r in resp["results"]] == ["petrenko"]


@pytest.mark.django_db
def test_unrelated_query_finds_nothing():
    me = _user("me", 1500)
    _user("petrenko", 1400)
    resp = _auth(me).get(reverse(URL), {"search": "zzzzzz"}).json()
    assert resp["results"] == []


@pytest.mark.django_db
def test_two_char_query_is_prefix_match():
    # Under 3 chars there is no trigram signal, so it falls back to "starts with".
    me = _user("petro", 1500)  # starts with "pe"
    _user("alpetrov", 1400)  # "pe" only in the middle
    resp = _auth(me).get(reverse(URL), {"search": "pe"}).json()
    assert [r["username"] for r in resp["results"]] == ["petro"]


@pytest.mark.django_db
def test_search_keeps_global_rank():
    me = _user("me", 3000)
    for i in range(5):  # five higher-rated coders
        _user(f"top{i}", 2000 + i * 10)
    _user("petrenko", 1400)
    resp = _auth(me).get(reverse(URL), {"search": "petrenko"}).json()
    row = resp["results"][0]
    assert row["username"] == "petrenko"
    # Global position, not position-within-the-search-result (which would be 1).
    assert row["globalRank"] == 7


@pytest.mark.django_db
def test_search_leaves_total_untouched():
    me = _user("me", 1500)
    for i in range(4):
        _user(f"coder{i}", 1000 + i)
    total_all = _auth(me).get(reverse(URL)).json()["total"]
    total_search = _auth(me).get(reverse(URL), {"search": "coder0"}).json()["total"]
    assert total_search == total_all == 5


@pytest.mark.django_db
def test_you_present_when_searching_others():
    me = _user("dimitri", 1500)
    _user("petrenko", 1400)
    resp = _auth(me).get(reverse(URL), {"search": "petrenko"}).json()
    assert resp["you"]["username"] == "dimitri"
    assert "dimitri" not in [r["username"] for r in resp["results"]]


@pytest.mark.django_db
def test_search_composes_with_tier():
    me = _user("me", 3000)
    _user("petro_expert", 1650)  # Expert  [1600, 1800)
    _user("petro_junior", 1250)  # Junior  [1200, 1400)
    resp = _auth(me).get(reverse(URL), {"search": "petro", "tier": "Expert"}).json()
    names = [r["username"] for r in resp["results"]]
    assert "petro_expert" in names
    assert "petro_junior" not in names
