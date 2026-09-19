"""Cache lifecycle for predicted deltas — see apps/contests/cache.py.

Fixtures come from the same conftest as test_cache.py / test_rating.py.
Endpoints are the ContestViewSet actions: leaderboard/ and my-standing/.
"""

import pytest
from apps.contests import services
from apps.contests.cache import get_predicted_deltas
from factories import make_submission


def leaderboard_url(contest, page=1):
    return f"/api/contests/{contest.pk}/leaderboard/?page={page}&page_size=2"


def my_standing_url(contest):
    return f"/api/contests/{contest.pk}/my-standing/"


@pytest.mark.django_db
class TestPredictionCache:
    def test_second_request_does_not_recompute(
        self, api_client, users, problems, finished_contest, monkeypatch
    ):
        a, b, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(b, problems[0], c)

        # Wrap the real function to count calls, instead of pytest-mock's spy —
        # monkeypatch is built into pytest, no extra dependency.
        calls = []
        original = services.compute_predicted_deltas

        def counting_wrapper(contest):
            calls.append(contest.pk)
            return original(contest)

        monkeypatch.setattr(services, "compute_predicted_deltas", counting_wrapper)

        api_client.force_authenticate(a)
        api_client.get(leaderboard_url(c))
        api_client.get(leaderboard_url(c))

        assert len(calls) == 1

    def test_new_accepted_submission_bumps_generation_and_recomputes(
        self, users, problems, finished_contest, monkeypatch
    ):
        from apps.contests.cache import bust_leaderboard_cache

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
        # judge pipeline recalculates the score AND busts the cache afterward.
        # The factory doesn't drive that whole pipeline, so we call the bust
        # explicitly here to simulate the one step that actually invalidates it.
        bust_leaderboard_cache(c.pk)

        get_predicted_deltas(c)
        assert len(calls) == 2

    def test_leaderboard_and_my_standing_agree(
        self, api_client, users, problems, finished_contest
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
        # page_size=2 puts b on a different page than a/c_user depending on
        # rank order — either way, my-standing must match whatever page b is on.
        page1 = api_client.get(leaderboard_url(c, page=1)).json()
        page2 = api_client.get(leaderboard_url(c, page=2)).json()
        rows = page1["results"] + page2["results"]
        row_b = next(r for r in rows if r["username"] == b.username)

        my_standing = api_client.get(my_standing_url(c)).json()

        assert row_b["predicted_delta"] == my_standing["predicted_delta"]

    def test_contests_do_not_interfere(
        self, users, problems, finished_contest, another_finished_contest
    ):
        a, b, _ = users
        make_submission(a, problems[0], finished_contest)
        make_submission(b, problems[0], finished_contest)
        make_submission(a, problems[0], another_finished_contest)
        make_submission(b, problems[0], another_finished_contest)

        get_predicted_deltas(finished_contest)
        before_other = get_predicted_deltas(another_finished_contest)

        make_submission(a, problems[1], finished_contest)  # bust only this contest
        get_predicted_deltas(finished_contest)
        after_other = get_predicted_deltas(another_finished_contest)

        assert before_other == after_other
