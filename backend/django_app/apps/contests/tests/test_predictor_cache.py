"""Cache lifecycle for predicted deltas — see get_predicted_deltas in
apps/contests/services.py and predicted_deltas_cache_key in
apps/contests/cache.py.

Fixtures come from the same conftest as test_cache.py / test_rating.py.
Endpoints are the ContestViewSet actions: leaderboard/ and my-standing/.
"""

import pytest
from apps.contests import services
from apps.contests.cache import bust_leaderboard_cache
from apps.contests.services import get_predicted_deltas
from django.core.cache import cache
from factories import make_submission


@pytest.fixture(autouse=True)
def clear_cache():
    """Predicted-delta and leaderboard-page caches live in one in-process
    dict for the whole test run; the DB rolls back after each test but this
    cache does not. Without clearing it, a value left by one test can leak
    into the next test that happens to land on the same generation number."""
    cache.clear()
    yield
    cache.clear()


def leaderboard_url(contest, page=1):
    return f"/api/contests/{contest.pk}/leaderboard/?page={page}&page_size=2"


def my_standing_url(contest):
    return f"/api/contests/{contest.pk}/my-standing/"


@pytest.mark.django_db
def test_leaderboard_and_my_standing_share_one_prediction_computation(
    api_client, users, problems, finished_contest, monkeypatch
):
    """leaderboard/ caches its whole page envelope, so a second hit never
    reaches get_predicted_deltas at all — that would test the PAGE cache,
    already covered by test_cache.py. my-standing/ doesn't cache its
    envelope, so pairing it with the leaderboard forces a real second pass
    through get_predicted_deltas; only a genuine cache hit keeps the count
    at one, and it also proves both endpoints read the same cached dict."""
    a, b, c_user = users
    c = finished_contest
    c.participants.add(a, b, c_user)
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    calls = []
    original = services.compute_predicted_deltas

    def counting_wrapper(contest):
        calls.append(contest.pk)
        return original(contest)

    monkeypatch.setattr(services, "compute_predicted_deltas", counting_wrapper)

    api_client.force_authenticate(a)
    api_client.get(leaderboard_url(c))
    api_client.get(my_standing_url(c))

    assert len(calls) == 1


@pytest.mark.django_db
def test_new_accepted_submission_bumps_generation_and_recomputes(
    users, problems, finished_contest, monkeypatch
):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    calls = []
    original = services.compute_predicted_deltas

    def counting_wrapper(contest):
        calls.append(contest.pk)
        return original(contest)

    monkeypatch.setattr(services, "compute_predicted_deltas", counting_wrapper)

    get_predicted_deltas(c)
    assert len(calls) == 1

    make_submission(a, problems[1], c)
    # The test factory only inserts the Submission row; in production the
    # judge pipeline recalculates the score and busts the cache as one step.
    # The factory doesn't drive that pipeline, so the bust is done explicitly
    # here to simulate the one step that actually invalidates the cache.
    bust_leaderboard_cache(c.pk)

    get_predicted_deltas(c)
    assert len(calls) == 2


@pytest.mark.django_db
def test_leaderboard_and_my_standing_agree(
    api_client, users, problems, finished_contest
):
    a, b, c_user = users
    c = finished_contest
    c.participants.add(a, b, c_user)  # get_leaderboard() reads from
    # contest.participants, not from who submitted — without this the
    # leaderboard is empty and page=2 below 404s instead of returning rows.
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)
    make_submission(c_user, problems[1], c)

    api_client.force_authenticate(b)
    # page_size=2 puts b on a different page than a/c_user depending on rank
    # order — either way, my-standing must match whatever page b is on.
    page1 = api_client.get(leaderboard_url(c, page=1)).json()
    page2 = api_client.get(leaderboard_url(c, page=2)).json()
    rows = page1["results"] + page2["results"]
    row_b = next(r for r in rows if r["username"] == b.username)

    my_standing = api_client.get(my_standing_url(c)).json()

    assert row_b["predicted_delta"] == my_standing["predicted_delta"]


@pytest.mark.django_db
def test_registered_non_submitter_leaderboard_row_is_null_not_zero(
    api_client, users, problems, finished_contest
):
    """The rating-set dict already omits non-rated users — this checks the
    OTHER half: the serializer must turn "missing from the dict" into a JSON
    `null`, not a `0`, which a viewer would misread as "rated, got zero"
    instead of "not rated at all"."""
    a, b, lurker = users
    c = finished_contest
    c.participants.add(a, b, lurker)
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    api_client.force_authenticate(a)
    # page_size big enough to fit all three participants on one page — this
    # test is about the null-vs-zero distinction, not pagination.
    response = api_client.get(f"/api/contests/{c.pk}/leaderboard/?page_size=10")
    rows = response.json()["results"]
    row = next(r for r in rows if r["username"] == lurker.username)

    assert "predicted_delta" in row
    assert row["predicted_delta"] is None


@pytest.mark.django_db
def test_contests_do_not_interfere(
    users, problems, finished_contest, another_finished_contest, monkeypatch
):
    a, b, _ = users
    make_submission(a, problems[0], finished_contest)
    make_submission(b, problems[0], finished_contest)
    make_submission(a, problems[0], another_finished_contest)
    make_submission(b, problems[0], another_finished_contest)

    calls = []
    original = services.compute_predicted_deltas

    def counting_wrapper(contest):
        calls.append(contest.pk)
        return original(contest)

    monkeypatch.setattr(services, "compute_predicted_deltas", counting_wrapper)

    get_predicted_deltas(finished_contest)
    get_predicted_deltas(another_finished_contest)
    assert calls.count(another_finished_contest.pk) == 1

    # Bust only the first contest's cache — the second's must stay untouched.
    bust_leaderboard_cache(finished_contest.pk)

    get_predicted_deltas(finished_contest)
    get_predicted_deltas(another_finished_contest)

    assert calls.count(another_finished_contest.pk) == 1  # not recomputed again
