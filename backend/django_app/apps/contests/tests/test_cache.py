"""Tests for the leaderboard page cache: GET /api/contests/{id}/leaderboard/.

The whole response envelope is cached and invalidated by a generation counter,
not a timer. These pin the parts that make that correct: a hit serves the old
copy, a bust orphans every warmed page at once (the generation trick), pages
and contests stay isolated, and a cold bust doesn't raise.
"""

import pytest
from apps.contests.cache import (
    bust_leaderboard_cache,
    get_generation,
    leaderboard_page_key,
)
from apps.contests.models import ContestScore
from django.core.cache import cache
from django.urls import reverse
from factories import make_contest

# api_client, user come from conftest.


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _url(contest, **params):
    url = reverse("contests-leaderboard", args=[contest.pk])
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return url


def _fill(contest, django_user_model, n):
    for i in range(n):
        u = django_user_model.objects.create_user(
            username=f"p{i}", email=f"p{i}@t.com", password="pass"
        )
        contest.participants.add(u)
        ContestScore.objects.create(user=u, contest=contest, score=100 - i, penalty=i)


@pytest.mark.django_db
def test_page_is_cached(api_client, user, django_user_model):
    contest = make_contest("C")
    contest.participants.add(user)
    _fill(contest, django_user_model, 3)
    api_client.force_authenticate(user=user)

    first = api_client.get(_url(contest)).json()
    # Change the DB behind the cache's back: a cached response must not notice.
    ContestScore.objects.filter(contest=contest).update(score=999)
    assert api_client.get(_url(contest)).json() == first


@pytest.mark.django_db
def test_bust_serves_fresh_rows(api_client, user, django_user_model):
    contest = make_contest("C")
    contest.participants.add(user)
    _fill(contest, django_user_model, 3)
    api_client.force_authenticate(user=user)

    api_client.get(_url(contest))  # warm
    ContestScore.objects.filter(contest=contest).update(score=999)
    bust_leaderboard_cache(contest.pk)

    assert api_client.get(_url(contest)).json()["results"][0]["score"] == 999


@pytest.mark.django_db
def test_bust_reaches_every_warmed_page(api_client, user, django_user_model):
    """The core check of the generation mechanism: warm two pages, bust once,
    both must come back fresh — deleting keys by name would miss page 2."""
    contest = make_contest("C")
    contest.participants.add(user)
    _fill(contest, django_user_model, 14)
    api_client.force_authenticate(user=user)

    api_client.get(_url(contest, page=1))  # warm
    api_client.get(_url(contest, page=2))  # warm
    ContestScore.objects.filter(contest=contest).update(score=777)
    bust_leaderboard_cache(contest.pk)

    p1 = api_client.get(_url(contest, page=1)).json()
    p2 = api_client.get(_url(contest, page=2)).json()
    assert p1["results"][0]["score"] == 777
    assert p2["results"][0]["score"] == 777


@pytest.mark.django_db
def test_pages_and_page_sizes_cached_separately(api_client, user, django_user_model):
    contest = make_contest("C")
    contest.participants.add(user)
    _fill(contest, django_user_model, 14)
    api_client.force_authenticate(user=user)

    page1 = api_client.get(_url(contest, page=1)).json()
    page2 = api_client.get(_url(contest, page=2)).json()
    sized = api_client.get(_url(contest, page=1, page_size=3)).json()

    assert page1["results"][0] != page2["results"][0]
    assert len(page1["results"]) == 10
    assert len(sized["results"]) == 3


@pytest.mark.django_db
def test_count_is_refreshed_by_a_bust(api_client, user, django_user_model):
    """Proves the whole envelope is cached, not just the rows: a stale count
    would mean COUNT was re-run while rows came from cache."""
    contest = make_contest("C")
    contest.participants.add(user)
    api_client.force_authenticate(user=user)
    assert api_client.get(_url(contest)).json()["count"] == 1

    contest.participants.add(
        django_user_model.objects.create_user(
            username="late", email="late@t.com", password="pass"
        )
    )
    bust_leaderboard_cache(contest.pk)

    assert api_client.get(_url(contest)).json()["count"] == 2


@pytest.mark.django_db
def test_cache_is_per_contest(user):
    """Busting one contest must not disturb another's cached pages."""
    a, b = make_contest("A"), make_contest("B")
    before = leaderboard_page_key(b.pk, "1", "")
    generation = get_generation(b.pk)

    bust_leaderboard_cache(a.pk)

    assert get_generation(b.pk) == generation
    assert leaderboard_page_key(b.pk, "1", "") == before


@pytest.mark.django_db
def test_bust_bumps_generation_and_changes_keys(user):
    """Invalidation is a counter bump, since RedisCache has no delete_pattern."""
    contest = make_contest("C")
    before = leaderboard_page_key(contest.pk, "1", "")
    generation = get_generation(contest.pk)

    bust_leaderboard_cache(contest.pk)

    assert get_generation(contest.pk) == generation + 1
    assert leaderboard_page_key(contest.pk, "1", "") != before


@pytest.mark.django_db
def test_bust_on_cold_cache_does_not_raise(user):
    """cache.incr raises on a missing key — that's "nothing cached", not an error."""
    contest = make_contest("C")
    cache.clear()
    bust_leaderboard_cache(contest.pk)
    assert get_generation(contest.pk) == 1
