"""Tests for personal contest data: subtitle, rating, my-standing, contest-history."""

from datetime import timedelta

import pytest
from apps.contests.models import Contest, ContestScore
from apps.contests.services import calculate_score
from apps.contests.views import _leaderboard_rank
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="u", email="u@test.com", password="pass"
    )


@pytest.fixture
def other(db, django_user_model):
    return django_user_model.objects.create_user(
        username="o", email="o@test.com", password="pass"
    )


@pytest.fixture
def admin(db, django_user_model):
    return django_user_model.objects.create_superuser(
        username="adm", email="adm@test.com", password="pass"
    )


@pytest.fixture
def client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _problem(title):
    return Problem.objects.create(
        title=title,
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


def _active_contest():
    now = timezone.now()
    return Contest.objects.create(
        title="Live",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
        status=Contest.Status.ACTIVE,
    )


def _finished_contest(title="Past", hours_ago=1):
    now = timezone.now()
    return Contest.objects.create(
        title=title,
        start_time=now - timedelta(hours=hours_ago + 2),
        end_time=now - timedelta(hours=hours_ago),
        status=Contest.Status.FINISHED,
    )


def _sub(user, problem, contest, verdict):
    return Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


# --- Step 1: subtitle ------------------------------------------------------


@pytest.mark.django_db
def test_subtitle_in_list_and_detail(client):
    c = _active_contest()
    c.subtitle = "Round 1 · Div. 2"
    c.save()
    assert client.get(reverse("contests-list")).json()["results"][0]["subtitle"] == (
        "Round 1 · Div. 2"
    )
    assert client.get(reverse("contests-detail", args=[c.id])).json()["subtitle"] == (
        "Round 1 · Div. 2"
    )


@pytest.mark.django_db
def test_admin_can_write_subtitle(admin):
    api = APIClient()
    api.force_authenticate(user=admin)
    now = timezone.now()
    resp = api.post(
        reverse("contests-list"),
        {
            "title": "C",
            "subtitle": "Round 2 · Div. 1",
            "start_time": now + timedelta(hours=1),
            "end_time": now + timedelta(hours=3),
        },
        format="json",
    )
    assert resp.status_code == 201
    assert Contest.objects.get(pk=resp.json()["id"]).subtitle == "Round 2 · Div. 1"


# --- Step 2: rating fields -------------------------------------------------


@pytest.mark.django_db
def test_rating_fields_default_null(user):
    c = _active_contest()
    cs = ContestScore.objects.create(user=user, contest=c)
    assert cs.rating_delta is None
    assert cs.rating_after is None


@pytest.mark.django_db
def test_calculate_score_does_not_clobber_rating(user):
    c = _active_contest()
    p = _problem("P")
    c.problems.add(p)
    _sub(user, p, c, Submission.Verdict.AC)
    calculate_score(user, c)  # creates the ContestScore

    cs = ContestScore.objects.get(user=user, contest=c)
    cs.rating_delta = -42
    cs.rating_after = 2147
    cs.save()

    # New submission → recalc; rating fields must survive.
    _sub(user, p, c, Submission.Verdict.AC)
    calculate_score(user, c)

    cs.refresh_from_db()
    assert cs.rating_delta == -42
    assert cs.rating_after == 2147


# --- Step 3: my-standing ---------------------------------------------------


@pytest.mark.django_db
def test_my_standing_statuses_and_rank(client, user):
    c = _active_contest()
    solved, attempted, untouched = _problem("A"), _problem("B"), _problem("C")
    c.problems.add(solved, attempted, untouched)
    _sub(user, solved, c, Submission.Verdict.AC)
    _sub(user, attempted, c, Submission.Verdict.WA)
    calculate_score(user, c)

    data = client.get(reverse("contests-my-standing", args=[c.id])).json()
    assert data["solved"] == 1
    assert data["rank"] == 1
    statuses = {p["id"]: p["status"] for p in data["problems"]}
    assert statuses[solved.id] == "solved"
    assert statuses[attempted.id] == "attempted"
    assert statuses[untouched.id] == "open"


@pytest.mark.django_db
def test_my_standing_no_contestscore(client):
    c = _active_contest()
    p = _problem("A")
    c.problems.add(p)
    data = client.get(reverse("contests-my-standing", args=[c.id])).json()
    assert data["score"] == 0
    assert data["solved"] == 0
    assert data["rank"] is None
    assert data["problems"][0]["status"] == "open"


@pytest.mark.django_db
def test_leaderboard_rank_returns_none_when_user_absent(user):
    c = _active_contest()  # no ContestScore for anyone → empty leaderboard
    assert _leaderboard_rank(c, user.pk) is None


@pytest.mark.django_db
def test_my_standing_requires_auth():
    c = _active_contest()
    resp = APIClient().get(reverse("contests-my-standing", args=[c.id]))
    assert resp.status_code in (401, 403)


# --- contest history (public by username) ----------------------------------


def _history_url(username):
    return reverse("users:user-contest-history", args=[username])


@pytest.mark.django_db
def test_history_only_finished_mine_newest_first(client, user, other):
    older = _finished_contest("Older", hours_ago=10)
    newer = _finished_contest("Newer", hours_ago=1)
    active = _active_contest()
    other_finished = _finished_contest("Others", hours_ago=2)

    ContestScore.objects.create(user=user, contest=older, solved_count=1)
    ContestScore.objects.create(user=user, contest=newer, solved_count=3)
    ContestScore.objects.create(
        user=user, contest=active, solved_count=2
    )  # not finished
    ContestScore.objects.create(user=other, contest=other_finished)  # not mine

    data = client.get(_history_url(user.username)).json()["results"]
    ids = [row["id"] for row in data]
    assert ids == [newer.id, older.id]  # newest first; active + others excluded


@pytest.mark.django_db
def test_history_requires_auth(user):
    resp = APIClient().get(_history_url(user.username))
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_history_unknown_username_404(client):
    assert client.get(_history_url("ghost")).status_code == 404


@pytest.mark.django_db
def test_history_fields(client, user):
    c = _finished_contest("Done")
    c.subtitle = "Round 2 · Div. 1"
    c.save()
    c.problems.add(
        _problem("A"), _problem("B"), _problem("C"), _problem("D"), _problem("E")
    )
    ContestScore.objects.create(
        user=user, contest=c, solved_count=3, rating_delta=-42, rating_after=2147
    )

    row = client.get(_history_url(user.username)).json()["results"][0]
    assert row["title"] == "Done"
    assert row["subtitle"] == "Round 2 · Div. 1"
    assert row["solved"] == 3
    assert row["problems_count"] == 5  # "3/5" on the frontend
    assert row["rank"] == 1
    assert row["rating_delta"] == -42
    assert row["rating_after"] == 2147


@pytest.mark.django_db
def test_history_problems_count(client, user):
    with_problems = _finished_contest("With", hours_ago=1)
    with_problems.problems.add(_problem("A"), _problem("B"))
    empty = _finished_contest("Empty", hours_ago=2)  # no problems
    ContestScore.objects.create(user=user, contest=with_problems, solved_count=1)
    ContestScore.objects.create(user=user, contest=empty, solved_count=0)

    by_title = {
        r["title"]: r["problems_count"]
        for r in client.get(_history_url(user.username)).json()["results"]
    }
    assert by_title["With"] == 2
    assert by_title["Empty"] == 0  # contest with no problems → 0


@pytest.mark.django_db
def test_history_no_n_plus_one(client, user, django_assert_num_queries):
    # Query count must not grow with the number of history rows.
    for i in range(5):
        c = _finished_contest(f"C{i}", hours_ago=i + 1)
        c.problems.add(_problem(f"P{i}a"), _problem(f"P{i}b"))
        ContestScore.objects.create(user=user, contest=c, solved_count=1)

    url = _history_url(user.username)
    # Fixed regardless of row count: user lookup + pagination COUNT + the single
    # history query (rank & problems_count are inline subqueries, not per-row).
    with django_assert_num_queries(3):
        resp = client.get(url)
    results = resp.json()["results"]
    assert len(results) == 5
    assert all(row["problems_count"] == 2 for row in results)


@pytest.mark.django_db
def test_history_rating_fields_null_when_unpopulated(client, user):
    c = _finished_contest("Done")
    ContestScore.objects.create(user=user, contest=c, solved_count=1)
    row = client.get(_history_url(user.username)).json()["results"][0]
    assert row["rating_delta"] is None
    assert row["rating_after"] is None


@pytest.mark.django_db
def test_any_authenticated_sees_other_users_history(client, other):
    c = _finished_contest("Done")
    ContestScore.objects.create(user=other, contest=c, solved_count=2)
    # `client` is authenticated as `user`, requesting `other`'s history.
    data = client.get(_history_url(other.username)).json()["results"]
    assert len(data) == 1 and data[0]["id"] == c.id


# --- rank annotation (single query, matches leaderboard) -------------------


@pytest.mark.django_db
def test_history_rank_matches_leaderboard_by_score(client, user, other, admin):
    c = _finished_contest("Done")
    # scores: admin 300 (rank1), user 200 (rank2), other 100 (rank3)
    ContestScore.objects.create(user=admin, contest=c, score=300, solved_count=3)
    ContestScore.objects.create(user=user, contest=c, score=200, solved_count=2)
    ContestScore.objects.create(user=other, contest=c, score=100, solved_count=1)

    assert client.get(_history_url(user.username)).json()["results"][0]["rank"] == 2
    assert client.get(_history_url(other.username)).json()["results"][0]["rank"] == 3
    assert client.get(_history_url(admin.username)).json()["results"][0]["rank"] == 1


@pytest.mark.django_db
def test_history_rank_tiebreak_penalty_then_time(client, user, other, admin):
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

    assert client.get(_history_url(admin.username)).json()["results"][0]["rank"] == 1
    assert client.get(_history_url(user.username)).json()["results"][0]["rank"] == 2
    assert client.get(_history_url(other.username)).json()["results"][0]["rank"] == 3


@pytest.mark.django_db
def test_history_rank_null_last_ac_at_ranks_bottom(client, user, other):
    c = _finished_contest("Done")
    # solver (score>0, has last_ac_at) ranks above the no-solver (score 0, NULL time)
    ContestScore.objects.create(
        user=other, contest=c, score=100, solved_count=1, last_ac_at=timezone.now()
    )
    ContestScore.objects.create(
        user=user, contest=c, score=0, solved_count=0, last_ac_at=None
    )
    assert client.get(_history_url(other.username)).json()["results"][0]["rank"] == 1
    assert client.get(_history_url(user.username)).json()["results"][0]["rank"] == 2
