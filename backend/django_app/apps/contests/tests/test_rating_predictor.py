"""Read-only rating prediction — see apps/contests/services.py.

Fixtures (users, problems, finished_contest, make_submission) come from the
same conftest/factories as test_rating.py.
"""

import pytest
from apps.contests.models import ContestScore
from apps.contests.services import apply_contest_ratings, compute_predicted_deltas
from apps.submissions.models import Submission
from factories import make_submission


@pytest.mark.django_db
def test_each_rated_participant_gets_a_prediction(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(a, problems[1], c)
    make_submission(b, problems[0], c)

    deltas = compute_predicted_deltas(c)

    assert set(deltas) == {a.id, b.id}


@pytest.mark.django_db
def test_deltas_sum_close_to_zero(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(a, problems[1], c)
    make_submission(b, problems[0], c)

    deltas = compute_predicted_deltas(c)

    assert abs(sum(deltas.values())) <= 1  # rounding slack


@pytest.mark.django_db
def test_leader_positive_last_negative_for_comparable_ratings(
    users, problems, finished_contest
):
    a, b, _ = users  # same starting rating (1200) per conftest
    c = finished_contest
    make_submission(a, problems[0], c)  # a: 2 solved → rank 1
    make_submission(a, problems[1], c)
    make_submission(b, problems[0], c)  # b: 1 solved → rank 2

    deltas = compute_predicted_deltas(c)

    assert deltas[a.id] > 0
    assert deltas[b.id] < 0


@pytest.mark.django_db
def test_same_result_same_rating_same_delta(users, problems, finished_contest):
    a, b, c_user = users
    c = finished_contest
    # a and c_user both solve exactly problems[0], same starting rating (1200)
    make_submission(a, problems[0], c)
    make_submission(c_user, problems[0], c)
    make_submission(b, problems[1], c)  # third rated participant, same rating

    # Force an exact tie on place_key: real submission timestamps always
    # differ by at least microseconds, which would otherwise break the tie
    # via the last_ac_at tiebreak — this isolates "same result" from "who
    # happened to submit first".
    cs_a = ContestScore.objects.get(user=a, contest=c)
    ContestScore.objects.filter(user=c_user, contest=c).update(
        penalty=cs_a.penalty, last_ac_at=cs_a.last_ac_at
    )

    deltas = compute_predicted_deltas(c)

    assert deltas[a.id] == deltas[c_user.id]


@pytest.mark.django_db
def test_same_result_different_rating_weaker_gains_more(users, problems, finished_contest):
    a, b, _ = users
    b.elo_rating = 1000  # weaker than a's 1200
    b.save(update_fields=["elo_rating"])
    c = finished_contest
    make_submission(a, problems[0], c)  # a and b get the SAME result...
    make_submission(b, problems[0], c)  # ...but b is weaker on paper

    cs_a = ContestScore.objects.get(user=a, contest=c)
    ContestScore.objects.filter(user=b, contest=c).update(
        penalty=cs_a.penalty, last_ac_at=cs_a.last_ac_at
    )

    deltas = compute_predicted_deltas(c)

    assert deltas[b.id] > deltas[a.id]


@pytest.mark.django_db
def test_single_submitter_no_prediction(users, problems, finished_contest):
    a, _, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)

    assert compute_predicted_deltas(c) == {}


@pytest.mark.django_db
def test_registered_no_submission_gets_no_prediction(users, problems, finished_contest):
    a, b, lurker = users
    c = finished_contest
    c.participants.add(lurker)  # joined, never submits
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    deltas = compute_predicted_deltas(c)

    assert lurker.id not in deltas


@pytest.mark.django_db
def test_submitted_nothing_solved_gets_last_place_prediction(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c, Submission.Verdict.WA)  # only WA

    deltas = compute_predicted_deltas(c)

    assert b.id in deltas
    assert deltas[b.id] < 0


@pytest.mark.django_db
def test_prediction_present_before_rating_applied(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    assert compute_predicted_deltas(c) != {}


@pytest.mark.django_db
def test_prediction_empty_after_rating_applied(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    apply_contest_ratings(c)
    c.refresh_from_db()

    assert compute_predicted_deltas(c) == {}


@pytest.mark.django_db
def test_prediction_matches_actual_delta_when_nothing_changes(users, problems, finished_contest):
    """The most valuable test in the branch: proves we show people the real
    number, not a plausible-looking guess."""
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