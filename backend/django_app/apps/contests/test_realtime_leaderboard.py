"""Tests for refactor/realtime-leaderboard.

The contract this file pins down: the socket signals, HTTP carries the data.
That means the leaderboard endpoint has to be good enough to be the single
source of truth — every registered participant present, dense ranks that stay
global across pages, my-standing agreeing with the table, a cache that is
invalidated by writes rather than by luck, and joining that can't be undone
once the contest is under way.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.contests.cache import (
    bust_leaderboard_cache,
    get_generation,
    leaderboard_page_key,
)
from apps.contests.models import Contest, ContestScore
from apps.contests.services import get_leaderboard, get_participant_rank
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

# --- fixtures & helpers ----------------------------------------------------


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        username="me", email="me@test.com", password="pass"
    )


@pytest.fixture
def client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _contest(title="C", *, starts_in=-1, ends_in=1):
    now = timezone.now()
    return Contest.objects.create(
        title=title,
        start_time=now + timedelta(hours=starts_in),
        end_time=now + timedelta(hours=ends_in),
    )


def _make_user(django_user_model, name, elo=1200):
    return django_user_model.objects.create_user(
        username=name, email=f"{name}@test.com", password="pass", elo_rating=elo
    )


def _score(contest, user, score, penalty=0, minutes_ago=5):
    return ContestScore.objects.create(
        contest=contest,
        user=user,
        score=score,
        penalty=penalty,
        solved_count=1 if score else 0,
        last_ac_at=timezone.now() - timedelta(minutes=minutes_ago),
    )


def _lb_url(cid):
    return reverse("contests-leaderboard", args=[cid])


# --- leaderboard composition -----------------------------------------------


@pytest.mark.django_db
def test_leaderboard_includes_participants_without_a_score(
    client, user, django_user_model
):
    """A registered no-show is a row with zeros, not a missing row.

    The frontend renders this table verbatim; someone who joined and never
    submitted has to be able to find themselves in it.
    """
    contest = _contest()
    scorer = _make_user(django_user_model, "scorer")
    contest.participants.add(user, scorer)
    _score(contest, scorer, score=100)

    rows = {r.username: r for r in get_leaderboard(contest)}

    assert set(rows) == {"me", "scorer"}
    assert rows["me"].score == 0
    assert rows["me"].penalty == 0
    assert rows["me"].solved_count == 0
    assert rows["me"].last_ac_at is None
    assert rows["me"].rating_delta is None


@pytest.mark.django_db
def test_leaderboard_excludes_non_participants(client, user, django_user_model):
    """Only registered participants — a stray ContestScore doesn't add a row."""
    contest = _contest()
    contest.participants.add(user)
    outsider = _make_user(django_user_model, "outsider")
    _score(contest, outsider, score=500)

    assert [r.username for r in get_leaderboard(contest)] == ["me"]


# --- ranking ----------------------------------------------------------------


@pytest.mark.django_db
def test_dense_rank_ties_share_a_place(user, django_user_model):
    """Dense ranking: 1, 2, 2, 3 — the tie does not consume the next number."""
    contest = _contest()
    a = _make_user(django_user_model, "a")
    b = _make_user(django_user_model, "b")
    c = _make_user(django_user_model, "c")
    contest.participants.add(a, b, c, user)

    tie = timezone.now() - timedelta(minutes=5)
    _score(contest, a, score=300)
    for u in (b, c):
        cs = _score(contest, u, score=200)
        ContestScore.objects.filter(pk=cs.pk).update(last_ac_at=tie)
    # `user` has no score at all → last place.

    ranks = {r.username: r.rank for r in get_leaderboard(contest)}
    assert ranks == {"a": 1, "b": 2, "c": 2, "me": 3}


@pytest.mark.django_db
def test_rank_survives_pagination(client, user, django_user_model):
    """Rank is a window over the whole table, not a position in the page."""
    contest = _contest()
    contest.participants.add(user)
    for i in range(12):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=1000 - i * 10)

    page2 = client.get(_lb_url(contest.id), {"page": 2}).json()

    # 13 participants, 10 per page → the second page starts at rank 11.
    assert page2["results"][0]["rank"] == 11


@pytest.mark.django_db
def test_page_size_is_client_controlled_and_capped(client, user, django_user_model):
    contest = _contest()
    contest.participants.add(user)
    for i in range(9):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 - i)

    assert len(client.get(_lb_url(contest.id)).json()["results"]) == 10  # default
    assert len(client.get(_lb_url(contest.id), {"page_size": 3}).json()["results"]) == 3
    # Above max_page_size the paginator clamps rather than obeying.
    assert (
        len(client.get(_lb_url(contest.id), {"page_size": 999}).json()["results"]) == 10
    )


# --- my-standing agrees with the table --------------------------------------


@pytest.mark.django_db
def test_my_standing_rank_matches_the_leaderboard(client, user, django_user_model):
    """The number in the sticky row must equal the number in the table.

    get_participant_rank can't reuse the window from get_leaderboard (a WHERE
    on the user is applied before the window, which would collapse every rank
    to 1), so the two computations are independent and have to be checked
    against each other.
    """
    contest = _contest()
    contest.participants.add(user)
    for i in range(6):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 - i * 10)
    _score(contest, user, score=75)  # lands mid-table

    from_table = {r.username: r.rank for r in get_leaderboard(contest)}["me"]
    assert get_participant_rank(contest, user.pk) == from_table


@pytest.mark.django_db
def test_my_standing_rank_is_a_constant_number_of_queries(
    client, user, django_user_model, django_assert_num_queries
):
    """Ranking happens in the DB — the cost must not grow with the field."""
    contest = _contest()
    contest.participants.add(user)
    _score(contest, user, score=50)
    for i in range(3):
        u = _make_user(django_user_model, f"a{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 + i)

    with django_assert_num_queries(2) as captured:
        get_participant_rank(contest, user.pk)

    for i in range(30):
        u = _make_user(django_user_model, f"b{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 + i)

    with django_assert_num_queries(len(captured)):
        get_participant_rank(contest, user.pk)


@pytest.mark.django_db
def test_rank_of_non_participant_is_none(user):
    assert get_participant_rank(_contest(), user.pk) is None


# --- cache ------------------------------------------------------------------


@pytest.mark.django_db
def test_leaderboard_page_is_cached(client, user, django_user_model):
    contest = _contest()
    other = _make_user(django_user_model, "other")
    contest.participants.add(user, other)
    _score(contest, other, score=100)

    first = client.get(_lb_url(contest.id)).json()

    # Change the DB behind the cache's back: a cached response must not notice.
    ContestScore.objects.filter(contest=contest).update(score=999)
    assert client.get(_lb_url(contest.id)).json() == first


@pytest.mark.django_db
def test_busting_the_cache_serves_fresh_rows(client, user, django_user_model):
    contest = _contest()
    other = _make_user(django_user_model, "other")
    contest.participants.add(user, other)
    _score(contest, other, score=100)

    client.get(_lb_url(contest.id))
    ContestScore.objects.filter(contest=contest).update(score=999)
    bust_leaderboard_cache(contest.pk)

    top = client.get(_lb_url(contest.id)).json()["results"][0]
    assert top["score"] == 999


@pytest.mark.django_db
def test_bust_bumps_the_generation_and_changes_every_key(user):
    """Invalidation is a counter bump, because RedisCache has no delete_pattern."""
    contest = _contest()
    before_p1 = leaderboard_page_key(contest.pk, "1", "")
    before_p2 = leaderboard_page_key(contest.pk, "2", "")
    generation = get_generation(contest.pk)

    bust_leaderboard_cache(contest.pk)

    assert get_generation(contest.pk) == generation + 1
    # One bump orphans every page at once, not just the one we happened to hit.
    assert leaderboard_page_key(contest.pk, "1", "") != before_p1
    assert leaderboard_page_key(contest.pk, "2", "") != before_p2


@pytest.mark.django_db
def test_bust_on_a_cold_cache_does_not_raise(user):
    """cache.incr raises on a missing key — that's "nothing cached", not an error."""
    contest = _contest()
    cache.clear()  # no generation key exists
    bust_leaderboard_cache(contest.pk)
    assert get_generation(contest.pk) == 1


@pytest.mark.django_db
def test_cache_is_per_contest(client, user, django_user_model):
    """Busting one contest must not disturb another's cached pages."""
    a, b = _contest("A"), _contest("B")
    contest_user = _make_user(django_user_model, "x")
    for c in (a, b):
        c.participants.add(contest_user)
        _score(c, contest_user, score=10)

    key_b = leaderboard_page_key(b.pk, "1", "")
    bust_leaderboard_cache(a.pk)
    assert leaderboard_page_key(b.pk, "1", "") == key_b


# --- leave -------------------------------------------------------------------


@pytest.mark.django_db
def test_leave_is_allowed_before_the_start(client, user):
    contest = _contest(starts_in=1, ends_in=3)
    contest.participants.add(user)

    assert client.post(reverse("contests-leave", args=[contest.id])).status_code == 200
    assert not contest.participants.filter(pk=user.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("starts_in", "ends_in"),
    [(-1, 1), (-3, -1)],
    ids=["active", "finished"],
)
def test_leave_is_refused_once_the_contest_has_started(
    client, user, starts_in, ends_in
):
    """Leaving a started contest would rewrite the standings — including
    retroactively, on a contest that is already over and rated."""
    contest = _contest(starts_in=starts_in, ends_in=ends_in)
    contest.participants.add(user)

    assert client.post(reverse("contests-leave", args=[contest.id])).status_code == 400
    assert contest.participants.filter(pk=user.pk).exists()


@pytest.mark.django_db
def test_leave_goes_by_time_not_by_the_status_column(client, user):
    """`status` is a cached value refreshed by a beat and can lag a minute."""
    contest = _contest(starts_in=-1, ends_in=1)
    Contest.objects.filter(pk=contest.pk).update(status=Contest.Status.PENDING)
    contest.participants.add(user)

    assert client.post(reverse("contests-leave", args=[contest.id])).status_code == 400


# --- contest end -------------------------------------------------------------


@pytest.mark.django_db
def test_status_sweep_does_not_announce_the_end(user):
    """Time running out is not the same as results being final.

    update_contest_statuses only refreshes a cached column; announcing the end
    there would close viewers' sockets a beat before the ELO column exists.
    """
    from apps.contests.tasks import update_contest_statuses

    contest = _contest(starts_in=-3, ends_in=-1)
    Contest.objects.filter(pk=contest.pk).update(status=Contest.Status.ACTIVE)

    with patch("apps.contests.tasks._broadcast_contest_ended") as broadcast:
        update_contest_statuses()

    broadcast.assert_not_called()
    contest.refresh_from_db()
    assert contest.status == Contest.Status.FINISHED


@pytest.mark.django_db(transaction=True)
def test_rating_task_announces_the_end(user, django_user_model):
    """contest_ended rides with the ratings, so a refetch on it shows the deltas."""
    from apps.contests.tasks import apply_finished_contest_ratings

    contest = _contest(starts_in=-3, ends_in=-1)
    other = _make_user(django_user_model, "other")
    contest.participants.add(user, other)
    _score(contest, user, score=100)
    _score(contest, other, score=50)

    with patch("apps.contests.tasks._broadcast_contest_ended") as broadcast:
        apply_finished_contest_ratings()

    broadcast.assert_called_once_with([contest.pk])
    contest.refresh_from_db()
    assert contest.rating_applied is True


@pytest.mark.django_db(transaction=True)
def test_applying_ratings_busts_the_cache(client, user, django_user_model):
    """Every row grows a rating_delta — the cached pages are all wrong."""
    from apps.contests.services import apply_contest_ratings

    contest = _contest(starts_in=-3, ends_in=-1)
    other = _make_user(django_user_model, "other")
    contest.participants.add(user, other)
    _score(contest, user, score=100)
    _score(contest, other, score=50)

    assert client.get(_lb_url(contest.id)).json()["results"][0]["rating_delta"] is None
    apply_contest_ratings(contest)

    assert (
        client.get(_lb_url(contest.id)).json()["results"][0]["rating_delta"] is not None
    )


# --- ordering of the two side effects ----------------------------------------


@pytest.mark.django_db(transaction=True)
def test_an_ac_busts_the_cache_before_it_signals(user, django_user_model):
    """Order matters: clients refetch the instant the signal lands.

    Signalling first would race the bust, and whoever refetched in between
    would be handed the very page they were told to replace — then keep it for
    a full TTL.
    """
    from apps.problems.models import Problem
    from apps.submissions.models import Submission

    contest = _contest()
    contest.participants.add(user)
    problem = Problem.objects.create(
        title="P",
        description="d",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )
    contest.problems.add(problem)

    calls = []
    with (
        patch(
            "apps.submissions.signals.bust_leaderboard_cache",
            side_effect=lambda cid: calls.append("bust"),
        ),
        patch(
            "apps.submissions.signals.group_send",
            side_effect=lambda *a, **kw: calls.append("signal"),
        ),
    ):
        Submission.objects.create(
            user=user,
            problem=problem,
            contest=contest,
            code="x",
            language=Submission.Language.PYTHON,
            verdict=Submission.Verdict.AC,
        )

    assert calls[:2] == ["bust", "signal"]


# --- gaps from the spec's test list ------------------------------------------


@pytest.mark.django_db
def test_no_show_sinks_below_anyone_who_solved(user, django_user_model):
    """nulls_last is explicit, not inherited from Postgres' default.

    A no-show has last_ac_at=NULL; on an ASC ordering Postgres puts NULLs first
    unless told otherwise, which would float them to the top of the table.
    """
    contest = _contest()
    solver = _make_user(django_user_model, "solver")
    contest.participants.add(user, solver)
    _score(contest, solver, score=1)

    assert [r.username for r in get_leaderboard(contest)] == ["solver", "me"]


@pytest.mark.django_db
def test_participants_of_another_contest_are_excluded(user, django_user_model):
    other_contest = _contest("Other")
    stranger = _make_user(django_user_model, "stranger")
    other_contest.participants.add(stranger)
    _score(other_contest, stranger, score=500)

    mine = _contest("Mine")
    mine.participants.add(user)

    assert [r.username for r in get_leaderboard(mine)] == ["me"]


@pytest.mark.django_db
def test_count_is_participants_not_scorers(client, user, django_user_model):
    """The envelope's count must include people who solved nothing."""
    contest = _contest()
    contest.participants.add(user)
    for i in range(4):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
    _score(contest, user, score=10)  # exactly one person has a result

    assert client.get(_lb_url(contest.id)).json()["count"] == 5


@pytest.mark.django_db
def test_three_way_tie_shares_one_place(user, django_user_model):
    """1, 2, 2, 2, 3 — a three-way tie still consumes exactly one number."""
    contest = _contest()
    contest.participants.add(user)
    top = _make_user(django_user_model, "top")
    contest.participants.add(top)
    _score(contest, top, score=300)

    tie = timezone.now() - timedelta(minutes=5)
    for name in ("t1", "t2", "t3"):
        u = _make_user(django_user_model, name)
        contest.participants.add(u)
        cs = _score(contest, u, score=200)
        ContestScore.objects.filter(pk=cs.pk).update(last_ac_at=tie)

    ranks = [r.rank for r in get_leaderboard(contest)]
    assert ranks == [1, 2, 2, 2, 3]


@pytest.mark.django_db
def test_row_order_is_stable_across_identical_requests(client, user, django_user_model):
    """Ties are broken by id for row ORDER, so pagination can't duplicate or
    skip a row between requests."""
    contest = _contest()
    contest.participants.add(user)
    tie = timezone.now() - timedelta(minutes=5)
    for i in range(5):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        cs = _score(contest, u, score=100)
        ContestScore.objects.filter(pk=cs.pk).update(last_ac_at=tie)

    first = [r.username for r in get_leaderboard(contest)]
    second = [r.username for r in get_leaderboard(contest)]
    assert first == second


@pytest.mark.django_db
def test_participant_without_a_result_still_gets_a_rank(user):
    """They're in the table now, so my-standing must place them, not return None."""
    contest = _contest()
    contest.participants.add(user)

    assert get_participant_rank(contest, user.pk) == 1


@pytest.mark.django_db
def test_page_size_five_splits_six_rows(client, user, django_user_model):
    contest = _contest()
    contest.participants.add(user)
    for i in range(5):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 - i)

    page1 = client.get(_lb_url(contest.id), {"page_size": 5}).json()
    assert len(page1["results"]) == 5
    assert page1["next"] is not None

    page2 = client.get(_lb_url(contest.id), {"page": 2, "page_size": 5}).json()
    assert len(page2["results"]) == 1


@pytest.mark.django_db
def test_registrants_share_the_page_size_param(client, user, django_user_model):
    """Same paginator class, so the param lands on registrants too — intended."""
    contest = _contest()
    contest.participants.add(user)
    for i in range(4):
        contest.participants.add(_make_user(django_user_model, f"p{i}"))

    url = reverse("contests-registrants", args=[contest.id])
    assert len(client.get(url, {"page_size": 2}).json()["results"]) == 2


# --- cache: the parts the spec singles out -----------------------------------


@pytest.mark.django_db
def test_second_identical_request_skips_the_database(
    client, user, django_user_model, django_assert_num_queries
):
    contest = _contest()
    contest.participants.add(user)
    for i in range(3):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 - i)

    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as cold:
        client.get(_lb_url(contest.id))
    with CaptureQueriesContext(connection) as warm:
        client.get(_lb_url(contest.id))

    # The leaderboard window and its COUNT are both gone on the warm path; what
    # remains is auth plus fetching the contest for the permission check.
    assert len(warm) < len(cold)
    assert not any("dense_rank" in q["sql"].lower() for q in warm.captured_queries)


@pytest.mark.django_db
def test_pages_and_page_sizes_are_cached_separately(client, user, django_user_model):
    """A cached page 1 must never be served in place of page 2."""
    contest = _contest()
    contest.participants.add(user)
    for i in range(14):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 - i)

    page1 = client.get(_lb_url(contest.id), {"page": 1}).json()
    page2 = client.get(_lb_url(contest.id), {"page": 2}).json()
    sized = client.get(_lb_url(contest.id), {"page": 1, "page_size": 3}).json()

    assert page1["results"][0] != page2["results"][0]
    assert len(page1["results"]) == 10
    assert len(sized["results"]) == 3


@pytest.mark.django_db(transaction=True)
def test_busting_reaches_every_warmed_page(client, user, django_user_model):
    """The core check of the generation mechanism.

    Warm two pages, change the data, bust once — BOTH pages must come back
    fresh. Deleting keys by name would only have reached the one we remembered.
    """
    contest = _contest()
    contest.participants.add(user)
    for i in range(14):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=100 - i)

    client.get(_lb_url(contest.id), {"page": 1})  # warm
    client.get(_lb_url(contest.id), {"page": 2})  # warm

    ContestScore.objects.filter(contest=contest).update(score=777)
    bust_leaderboard_cache(contest.pk)

    page1 = client.get(_lb_url(contest.id), {"page": 1}).json()
    page2 = client.get(_lb_url(contest.id), {"page": 2}).json()
    assert page1["results"][0]["score"] == 777
    assert page2["results"][0]["score"] == 777


@pytest.mark.django_db
def test_count_is_refreshed_by_a_bust_too(client, user, django_user_model):
    """Proves the whole envelope is cached, not just the rows: a stale count
    would mean the paginator's COUNT was re-run while rows came from cache."""
    contest = _contest()
    contest.participants.add(user)
    assert client.get(_lb_url(contest.id)).json()["count"] == 1

    contest.participants.add(_make_user(django_user_model, "late"))
    bust_leaderboard_cache(contest.pk)

    assert client.get(_lb_url(contest.id)).json()["count"] == 2


@pytest.mark.django_db(transaction=True)
def test_ac_signals_the_group_without_any_leaderboard_data(user, django_user_model):
    """The message the signal puts on the group carries the type and nothing else."""
    from apps.problems.models import Problem
    from apps.submissions.models import Submission

    contest = _contest()
    contest.participants.add(user)
    problem = Problem.objects.create(
        title="P",
        description="d",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )
    contest.problems.add(problem)

    sent = []
    with patch(
        "apps.submissions.signals.group_send",
        side_effect=lambda group, message: sent.append((group, message)),
    ):
        Submission.objects.create(
            user=user,
            problem=problem,
            contest=contest,
            code="x",
            language=Submission.Language.PYTHON,
            verdict=Submission.Verdict.AC,
        )

    group, message = next(g for g in sent if g[0] == f"contest_{contest.pk}")
    assert message == {"type": "leaderboard_update"}  # no rows, no counts


@pytest.mark.django_db
def test_rated_set_is_unchanged_by_the_leaderboard_rework(user, django_user_model):
    """ELO must still see exactly the people with a ContestScore — no more.

    get_leaderboard grew to include no-shows; get_scored_rows is what ELO reads.
    Comparing the two querysets alone would not catch a regression — the point
    is which one apply_contest_ratings actually consumes, so this drives the
    real call and checks the number of users it touched.
    """
    from apps.contests.services import apply_contest_ratings, get_scored_rows

    contest = _contest(starts_in=-3, ends_in=-1)
    contest.participants.add(user)  # no-show: joined, never submitted
    for i in range(3):
        u = _make_user(django_user_model, f"p{i}")
        contest.participants.add(u)
        _score(contest, u, score=10 * i)

    assert get_leaderboard(contest).count() == 4  # everyone shows in the table
    assert get_scored_rows(contest).count() == 3  # only three are rated

    assert apply_contest_ratings(contest) == 3  # the no-show was not touched

    user.refresh_from_db()
    assert user.elo_rating == 1200
    assert not ContestScore.objects.filter(contest=contest, user=user).exists()


@pytest.mark.django_db
def test_ordering_spells_out_nulls_last_in_sql(user):
    """The only way to pin the explicit nulls_last: no behavioural test can.

    Postgres already puts NULLs last on an ASC ordering, so dropping the flag
    changes nothing today — and would silently change everything on a different
    backend or if the key ever flipped to DESC. Assert the SQL, not the rows.
    """
    contest = _contest()
    contest.participants.add(user)

    sql = str(get_leaderboard(contest).query).upper()
    assert "NULLS LAST" in sql
