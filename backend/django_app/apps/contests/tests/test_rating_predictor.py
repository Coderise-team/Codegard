"""Read-only rating prediction — see apps/contests/services.py.

Fixtures (users, problems, finished_contest, make_submission) come from the
same conftest/factories as test_rating.py.
"""

import pytest
from apps.contests.services import (
    apply_contest_ratings,
    compute_predicted_deltas,
)
from apps.contests.models import ContestScore
from apps.submissions.models import Submission
from factories import make_submission


@pytest.mark.django_db
class TestPredictedDeltasCalculation:
    def test_each_rated_participant_gets_a_prediction(self, users, problems, finished_contest):
        a, b, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(a, problems[1], c)
        make_submission(b, problems[0], c)

        deltas = compute_predicted_deltas(c)

        assert set(deltas) == {a.id, b.id}

    def test_deltas_sum_close_to_zero(self, users, problems, finished_contest):
        a, b, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(a, problems[1], c)
        make_submission(b, problems[0], c)

        deltas = compute_predicted_deltas(c)

        assert abs(sum(deltas.values())) <= 1  # rounding slack

    def test_leader_positive_last_negative_for_comparable_ratings(
        self, users, problems, finished_contest
    ):
        a, b, _ = users  # same starting rating (1200) per conftest
        c = finished_contest
        make_submission(a, problems[0], c)  # a: 1 solved → rank 1
        make_submission(a, problems[1], c)
        make_submission(b, problems[0], c)  # b: 1 solved → rank 2

        deltas = compute_predicted_deltas(c)

        assert deltas[a.id] > 0
        assert deltas[b.id] < 0

    def test_same_result_same_rating_same_delta(self, users, problems, finished_contest):
        a, b, c_user = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(c_user, problems[0], c)
        make_submission(b, problems[1], c)  # unrelated, keeps the field >2

        # Force an exact tie: score/penalty/last_ac_at identical. Real submission
        # timestamps always differ by at least microseconds, which would otherwise
        # break the tie via the last_ac_at tiebreak — this isolates "same result"
        # from "who happened to click submit first".
        cs_a = ContestScore.objects.get(user=a, contest=c)
        ContestScore.objects.filter(user=c_user, contest=c).update(
            penalty=cs_a.penalty, last_ac_at=cs_a.last_ac_at
        )

        deltas = compute_predicted_deltas(c)

        assert deltas[a.id] == deltas[c_user.id]

    def test_same_result_different_rating_weaker_gains_more(
            self, users, problems, finished_contest
    ):
        a, b, _ = users
        b.elo_rating = 1000  # weaker than a's 1200
        b.save(update_fields=["elo_rating"])
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(b, problems[0], c)

        # Same forced tie as above — otherwise a's earlier last_ac_at makes them
        # win outright, and this test isn't checking what it claims to check.
        cs_a = ContestScore.objects.get(user=a, contest=c)
        ContestScore.objects.filter(user=b, contest=c).update(
            penalty=cs_a.penalty, last_ac_at=cs_a.last_ac_at
        )

        deltas = compute_predicted_deltas(c)

        assert deltas[b.id] > deltas[a.id]

    def test_single_submitter_no_prediction(self, users, problems, finished_contest):
        a, _, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)

        assert compute_predicted_deltas(c) == {}


@pytest.mark.django_db
class TestRatingSetMembership:
    def test_registered_no_submission_gets_no_prediction(
        self, users, problems, finished_contest
    ):
        a, b, lurker = users
        c = finished_contest
        c.participants.add(lurker)  # joined, never submits
        make_submission(a, problems[0], c)
        make_submission(b, problems[0], c)

        deltas = compute_predicted_deltas(c)

        assert lurker.id not in deltas

    def test_submitted_nothing_solved_gets_last_place_prediction(
        self, users, problems, finished_contest
    ):
        a, b, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(b, problems[0], c, Submission.Verdict.WA)  # only WA

        deltas = compute_predicted_deltas(c)

        assert b.id in deltas
        assert deltas[b.id] < 0


@pytest.mark.django_db
class TestLifecycle:
    def test_prediction_present_before_rating_applied(self, users, problems, finished_contest):
        a, b, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(b, problems[0], c)

        assert compute_predicted_deltas(c) != {}

    def test_prediction_empty_after_rating_applied(self, users, problems, finished_contest):
        a, b, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(b, problems[0], c)

        apply_contest_ratings(c)
        c.refresh_from_db()

        assert compute_predicted_deltas(c) == {}

    def test_prediction_matches_actual_delta_when_nothing_changes(
        self, users, problems, finished_contest
    ):
        """The most valuable test in the branch: proves we show people the
        real number, not a plausible-looking guess."""
        a, b, _ = users
        c = finished_contest
        make_submission(a, problems[0], c)
        make_submission(a, problems[1], c)
        make_submission(b, problems[0], c)

        predicted = compute_predicted_deltas(c)
        apply_contest_ratings(c)

        actual = dict(
            ContestScore.objects.filter(contest=c).values_list("user_id", "rating_delta")
        )
        assert predicted == actual


@pytest.mark.django_db
class TestSharedExtraction:
    def test_shared_set_excludes_lurker_includes_zero_solver(
        self, users, problems, finished_contest
    ):
        from apps.contests.services import _collect_rating_participants

        a, b, lurker = users
        c = finished_contest
        c.participants.add(lurker)
        make_submission(a, problems[0], c)  # scored
        make_submission(a, problems[1], c)  # scored
        make_submission(b, problems[0], c, Submission.Verdict.WA)  # zero-solver

        ordered_uids, scored, zero_ids = _collect_rating_participants(c)

        assert a.id in ordered_uids
        assert b.id in zero_ids
        assert lurker.id not in ordered_uids