"""Rating fields and apply flow for the contest ELO rework.

The beat task that drives ``apply_contest_ratings`` lives in ``test_tasks``.
"""

import pytest
from apps.contests.models import ContestScore
from apps.contests.services import apply_contest_ratings, calculate_score
from apps.submissions.models import Submission
from apps.users.models import EloHistory
from factories import make_submission

# user, users, problems, finished_contest come from conftest.


# --- rating fields on ContestScore -----------------------------------------


@pytest.mark.django_db
def test_rating_fields_default_null(user, finished_contest):
    cs = ContestScore.objects.create(user=user, contest=finished_contest)
    assert cs.rating_delta is None
    assert cs.rating_after is None


@pytest.mark.django_db
def test_calculate_score_does_not_clobber_rating(user, problems, finished_contest):
    c = finished_contest
    p = problems[0]
    c.problems.add(p)
    make_submission(user, p, c)
    calculate_score(user, c)  # creates the ContestScore

    cs = ContestScore.objects.get(user=user, contest=c)
    cs.rating_delta = -42
    cs.rating_after = 2147
    cs.save()

    # New submission → recalc; rating fields must survive.
    make_submission(user, p, c)
    calculate_score(user, c)

    cs.refresh_from_db()
    assert cs.rating_delta == -42
    assert cs.rating_after == 2147


# --- main flow -------------------------------------------------------------


@pytest.mark.django_db
def test_apply_writes_everything(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)  # a: 2 solved → rank 1
    make_submission(a, problems[1], c)
    make_submission(b, problems[0], c)  # b: 1 solved → rank 2

    updated = apply_contest_ratings(c)
    assert updated == 2

    a.refresh_from_db()
    b.refresh_from_db()
    assert a.elo_rating == 1216 and b.elo_rating == 1184  # +16 / -16
    assert a.max_rating == 1216  # rose
    assert b.max_rating == 1200  # fell → pin unchanged

    cs_a = ContestScore.objects.get(user=a, contest=c)
    cs_b = ContestScore.objects.get(user=b, contest=c)
    assert (cs_a.rating_delta, cs_a.rating_after) == (16, 1216)
    assert (cs_b.rating_delta, cs_b.rating_after) == (-16, 1184)

    assert EloHistory.objects.filter(user=a).count() == 1
    assert EloHistory.objects.filter(user=b).count() == 1

    c.refresh_from_db()
    assert c.rating_applied is True


@pytest.mark.django_db
def test_submitted_but_solved_nothing_goes_minus_and_gets_contestscore(
    users, problems, finished_contest
):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)  # solver → rank 1
    make_submission(
        b, problems[0], c, Submission.Verdict.WA
    )  # only WA → no ContestScore yet

    apply_contest_ratings(c)

    b.refresh_from_db()
    assert b.elo_rating == 1184  # last place, minus
    cs_b = ContestScore.objects.get(user=b, contest=c)  # created for them
    assert cs_b.score == 0 and cs_b.solved_count == 0
    assert cs_b.rating_delta == -16
    assert cs_b.rating_after == 1184


@pytest.mark.django_db
def test_pure_no_show_not_rated(users, problems, finished_contest):
    a, b, c_user = users
    c = finished_contest
    c.participants.add(c_user)  # joined but never submits
    make_submission(a, problems[0], c)
    make_submission(b, problems[0], c)

    apply_contest_ratings(c)

    c_user.refresh_from_db()
    assert c_user.elo_rating == 1200  # untouched
    assert c_user.max_rating == 1200
    assert not ContestScore.objects.filter(user=c_user, contest=c).exists()


@pytest.mark.django_db
def test_idempotent(users, problems, finished_contest):
    a, b, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(a, problems[1], c)
    make_submission(b, problems[0], c)

    apply_contest_ratings(c)
    a.refresh_from_db()
    first = a.elo_rating

    second = apply_contest_ratings(c)  # already applied
    assert second == 0
    a.refresh_from_db()
    assert a.elo_rating == first  # unchanged
    assert EloHistory.objects.filter(user=a).count() == 1  # not doubled


@pytest.mark.django_db
def test_max_rating_keeps_peak_on_loss(users, problems, finished_contest):
    a, b, _ = users
    b.max_rating = 1300  # historical peak above current
    b.save(update_fields=["max_rating"])
    c = finished_contest
    make_submission(a, problems[0], c)
    make_submission(a, problems[1], c)
    make_submission(b, problems[0], c)

    apply_contest_ratings(c)

    b.refresh_from_db()
    assert b.elo_rating == 1184  # dropped
    assert b.max_rating == 1300  # peak preserved


@pytest.mark.django_db
def test_single_submitter_marks_applied_without_change(
    users, problems, finished_contest
):
    a, _, _ = users
    c = finished_contest
    make_submission(a, problems[0], c)  # only one submitter

    updated = apply_contest_ratings(c)

    assert updated == 0  # no opponents → nobody rated
    a.refresh_from_db()
    assert a.elo_rating == 1200  # untouched
    c.refresh_from_db()
    assert c.rating_applied is True  # but still marked done
