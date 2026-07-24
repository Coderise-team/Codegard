"""Tests for the public contest history: GET /api/users/{username}/contest-history/.

Covers what the list contains (only my finished contests, newest first), the
per-row fields, the rank annotation and its tiebreaks, page_size, and that the
query count does not grow with the number of rows.
"""

from datetime import timedelta

import pytest
from apps.contests.models import ContestScore
from django.urls import reverse
from django.utils import timezone
from factories import make_contest, make_problem
from rest_framework.test import APIClient

# user, other, admin and user_client come from conftest.


def _finished_contest(title="Past", hours_ago=1):
    """Contest that ended `hours_ago` hours ago."""
    return make_contest(title, starts_in=-(hours_ago + 2), ends_in=-hours_ago)


def _url(username):
    return reverse("users:user-contest-history", args=[username])


# --- what the list contains ------------------------------------------------


@pytest.mark.django_db
def test_only_finished_mine_newest_first(user_client, user, other):
    older = _finished_contest("Older", hours_ago=10)
    newer = _finished_contest("Newer", hours_ago=1)
    active = make_contest("Live")
    other_finished = _finished_contest("Others", hours_ago=2)

    ContestScore.objects.create(user=user, contest=older, solved_count=1)
    ContestScore.objects.create(user=user, contest=newer, solved_count=3)
    ContestScore.objects.create(
        user=user, contest=active, solved_count=2
    )  # not finished
    ContestScore.objects.create(user=other, contest=other_finished)  # not mine

    data = user_client.get(_url(user.username)).json()["results"]
    ids = [row["id"] for row in data]
    assert ids == [newer.id, older.id]  # newest first; active + others excluded


@pytest.mark.django_db
def test_requires_auth(user):
    resp = APIClient().get(_url(user.username))
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_unknown_username_404(user_client):
    assert user_client.get(_url("ghost")).status_code == 404


@pytest.mark.django_db
def test_any_authenticated_sees_other_users_history(user_client, other):
    c = _finished_contest("Done")
    ContestScore.objects.create(user=other, contest=c, solved_count=2)
    # `user_client` is authenticated as `user`, requesting `other`'s history.
    data = user_client.get(_url(other.username)).json()["results"]
    assert len(data) == 1 and data[0]["id"] == c.id


# --- row fields ------------------------------------------------------------


@pytest.mark.django_db
def test_fields(user_client, user):
    c = _finished_contest("Done")
    c.subtitle = "Round 2 · Div. 1"
    c.save()
    c.problems.add(
        make_problem("A"),
        make_problem("B"),
        make_problem("C"),
        make_problem("D"),
        make_problem("E"),
    )
    ContestScore.objects.create(
        user=user, contest=c, solved_count=3, rating_delta=-42, rating_after=2147
    )

    row = user_client.get(_url(user.username)).json()["results"][0]
    assert row["title"] == "Done"
    assert row["subtitle"] == "Round 2 · Div. 1"
    assert row["solved"] == 3
    assert row["problems_count"] == 5  # "3/5" on the frontend
    assert row["rank"] == 1
    assert row["rating_delta"] == -42
    assert row["rating_after"] == 2147


@pytest.mark.django_db
def test_problems_count(user_client, user):
    with_problems = _finished_contest("With", hours_ago=1)
    with_problems.problems.add(make_problem("A"), make_problem("B"))
    empty = _finished_contest("Empty", hours_ago=2)  # no problems
    ContestScore.objects.create(user=user, contest=with_problems, solved_count=1)
    ContestScore.objects.create(user=user, contest=empty, solved_count=0)

    by_title = {
        r["title"]: r["problems_count"]
        for r in user_client.get(_url(user.username)).json()["results"]
    }
    assert by_title["With"] == 2
    assert by_title["Empty"] == 0  # contest with no problems → 0


@pytest.mark.django_db
def test_rating_fields_null_when_unpopulated(user_client, user):
    c = _finished_contest("Done")
    ContestScore.objects.create(user=user, contest=c, solved_count=1)
    row = user_client.get(_url(user.username)).json()["results"][0]
    assert row["rating_delta"] is None
    assert row["rating_after"] is None


# --- rank annotation (single query, matches the leaderboard) ---------------


@pytest.mark.django_db
def test_rank_matches_leaderboard_by_score(user_client, user, other, admin):
    c = _finished_contest("Done")
    # scores: admin 300 (rank1), user 200 (rank2), other 100 (rank3)
    ContestScore.objects.create(user=admin, contest=c, score=300, solved_count=3)
    ContestScore.objects.create(user=user, contest=c, score=200, solved_count=2)
    ContestScore.objects.create(user=other, contest=c, score=100, solved_count=1)

    assert user_client.get(_url(user.username)).json()["results"][0]["rank"] == 2
    assert user_client.get(_url(other.username)).json()["results"][0]["rank"] == 3
    assert user_client.get(_url(admin.username)).json()["results"][0]["rank"] == 1


@pytest.mark.django_db
def test_rank_tiebreak_penalty_then_time(user_client, user, other, admin):
    c = _finished_contest("Done")
    now = timezone.now()
    # all same score: lower penalty wins; equal penalty -> earlier last_ac_at wins
    ContestScore.objects.create(
        user=admin, contest=c, score=100, penalty=5, last_ac_at=now
    )  # rank 1 (lowest penalty)
    ContestScore.objects.create(
        user=user,
        contest=c,
        score=100,
        penalty=9,
        last_ac_at=now - timedelta(minutes=1),
    )  # rank 2
    ContestScore.objects.create(
        user=other, contest=c, score=100, penalty=9, last_ac_at=now
    )  # rank 3 (same penalty as user, later time)

    assert user_client.get(_url(admin.username)).json()["results"][0]["rank"] == 1
    assert user_client.get(_url(user.username)).json()["results"][0]["rank"] == 2
    assert user_client.get(_url(other.username)).json()["results"][0]["rank"] == 3


@pytest.mark.django_db
def test_rank_null_last_ac_at_ranks_bottom(user_client, user, other):
    c = _finished_contest("Done")
    # solver (score>0, has last_ac_at) ranks above the no-solver (score 0, NULL time)
    ContestScore.objects.create(
        user=other, contest=c, score=100, solved_count=1, last_ac_at=timezone.now()
    )
    ContestScore.objects.create(
        user=user, contest=c, score=0, solved_count=0, last_ac_at=None
    )
    assert user_client.get(_url(other.username)).json()["results"][0]["rank"] == 1
    assert user_client.get(_url(user.username)).json()["results"][0]["rank"] == 2


# --- pagination & query count ----------------------------------------------


@pytest.mark.django_db
def test_page_size(user_client, user):
    for i in range(6):
        c = _finished_contest(f"H{i}", hours_ago=i + 1)
        ContestScore.objects.create(user=user, contest=c, solved_count=1)

    page1 = user_client.get(_url(user.username), {"page_size": 5}).json()
    assert page1["count"] == 6
    assert len(page1["results"]) == 5
    assert page1["next"] is not None
    page2 = user_client.get(_url(user.username), {"page_size": 5, "page": 2}).json()
    assert len(page2["results"]) == 1


@pytest.mark.django_db
def test_no_n_plus_one(user_client, user, django_assert_num_queries):
    # Query count must not grow with the number of history rows.
    for i in range(5):
        c = _finished_contest(f"C{i}", hours_ago=i + 1)
        c.problems.add(make_problem(f"P{i}a"), make_problem(f"P{i}b"))
        ContestScore.objects.create(user=user, contest=c, solved_count=1)

    # Fixed regardless of row count: user lookup + pagination COUNT + the single
    # history query (rank & problems_count are inline subqueries, not per-row).
    with django_assert_num_queries(3):
        resp = user_client.get(_url(user.username))
    results = resp.json()["results"]
    assert len(results) == 5
    assert all(row["problems_count"] == 2 for row in results)
