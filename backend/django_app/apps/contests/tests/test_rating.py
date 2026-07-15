"""Flow + task tests for the contest ELO rework."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.contests.models import Contest, ContestScore
from apps.contests.services import apply_contest_ratings
from apps.contests.tasks import apply_finished_contest_ratings
from apps.problems.models import Problem
from apps.submissions.models import Submission
from apps.users.models import EloHistory
from django.utils import timezone


@pytest.fixture
def users(db, django_user_model):
    return [
        django_user_model.objects.create_user(
            username=f"u{i}", email=f"u{i}@t.com", password="pass"
        )
        for i in range(3)
    ]


@pytest.fixture
def problems(db):
    return [
        Problem.objects.create(
            title=f"P{i}",
            description="",
            difficulty=Problem.Difficulty.EASY,
            time_limit=1000,
            memory_limit=256,
        )
        for i in range(2)
    ]


def _finished_contest():
    now = timezone.now()
    return Contest.objects.create(
        title="Done",
        start_time=now - timedelta(hours=3),
        end_time=now - timedelta(hours=1),
        status=Contest.Status.FINISHED,
    )


def _submit(user, problem, contest, verdict):
    # An AC submission fires the scoring signal → creates/updates ContestScore.
    return Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )


# --- main flow -------------------------------------------------------------


@pytest.mark.django_db
def test_apply_writes_everything(users, problems):
    a, b, _ = users
    c = _finished_contest()
    _submit(a, problems[0], c, Submission.Verdict.AC)  # a: 2 solved → rank 1
    _submit(a, problems[1], c, Submission.Verdict.AC)
    _submit(b, problems[0], c, Submission.Verdict.AC)  # b: 1 solved → rank 2

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
def test_submitted_but_solved_nothing_goes_minus_and_gets_contestscore(users, problems):
    a, b, _ = users
    c = _finished_contest()
    _submit(a, problems[0], c, Submission.Verdict.AC)  # solver → rank 1
    _submit(b, problems[0], c, Submission.Verdict.WA)  # only WA → no ContestScore yet

    apply_contest_ratings(c)

    b.refresh_from_db()
    assert b.elo_rating == 1184  # last place, minus
    cs_b = ContestScore.objects.get(user=b, contest=c)  # created for them
    assert cs_b.score == 0 and cs_b.solved_count == 0
    assert cs_b.rating_delta == -16
    assert cs_b.rating_after == 1184


@pytest.mark.django_db
def test_pure_no_show_not_rated(users, problems):
    a, b, c_user = users
    c = _finished_contest()
    c.participants.add(c_user)  # joined but never submits
    _submit(a, problems[0], c, Submission.Verdict.AC)
    _submit(b, problems[0], c, Submission.Verdict.AC)

    apply_contest_ratings(c)

    c_user.refresh_from_db()
    assert c_user.elo_rating == 1200  # untouched
    assert c_user.max_rating == 1200
    assert not ContestScore.objects.filter(user=c_user, contest=c).exists()


@pytest.mark.django_db
def test_idempotent(users, problems):
    a, b, _ = users
    c = _finished_contest()
    _submit(a, problems[0], c, Submission.Verdict.AC)
    _submit(a, problems[1], c, Submission.Verdict.AC)
    _submit(b, problems[0], c, Submission.Verdict.AC)

    apply_contest_ratings(c)
    a.refresh_from_db()
    first = a.elo_rating

    second = apply_contest_ratings(c)  # already applied
    assert second == 0
    a.refresh_from_db()
    assert a.elo_rating == first  # unchanged
    assert EloHistory.objects.filter(user=a).count() == 1  # not doubled


@pytest.mark.django_db
def test_max_rating_keeps_peak_on_loss(users, problems):
    a, b, _ = users
    b.max_rating = 1300  # historical peak above current
    b.save(update_fields=["max_rating"])
    c = _finished_contest()
    _submit(a, problems[0], c, Submission.Verdict.AC)
    _submit(a, problems[1], c, Submission.Verdict.AC)
    _submit(b, problems[0], c, Submission.Verdict.AC)

    apply_contest_ratings(c)

    b.refresh_from_db()
    assert b.elo_rating == 1184  # dropped
    assert b.max_rating == 1300  # peak preserved


@pytest.mark.django_db
def test_single_submitter_marks_applied_without_change(users, problems):
    a, _, _ = users
    c = _finished_contest()
    _submit(a, problems[0], c, Submission.Verdict.AC)  # only one submitter

    updated = apply_contest_ratings(c)

    assert updated == 0  # no opponents → nobody rated
    a.refresh_from_db()
    assert a.elo_rating == 1200  # untouched
    c.refresh_from_db()
    assert c.rating_applied is True  # but still marked done


# --- task ------------------------------------------------------------------


@pytest.mark.django_db
def test_task_isolates_failing_contest(users, problems):
    a, b, _ = users
    c = _finished_contest()
    _submit(a, problems[0], c, Submission.Verdict.AC)
    _submit(b, problems[0], c, Submission.Verdict.AC)

    # One bad contest must not crash the batch.
    with patch(
        "apps.contests.services.apply_contest_ratings", side_effect=RuntimeError("boom")
    ):
        summary = apply_finished_contest_ratings()  # must not raise

    assert summary["contests_processed"] == 0  # the failing one wasn't counted
    c.refresh_from_db()
    assert c.rating_applied is False  # left for the next run


@pytest.mark.django_db
def test_task_picks_finished_unrated_only(users, problems):
    a, b, _ = users
    now = timezone.now()

    finished = _finished_contest()
    _submit(a, problems[0], finished, Submission.Verdict.AC)
    _submit(b, problems[0], finished, Submission.Verdict.AC)

    already = _finished_contest()
    already.rating_applied = True
    already.save(update_fields=["rating_applied"])

    active = Contest.objects.create(
        title="Active",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
        status=Contest.Status.ACTIVE,
    )
    _submit(a, problems[0], active, Submission.Verdict.AC)
    _submit(b, problems[0], active, Submission.Verdict.AC)

    summary = apply_finished_contest_ratings()

    assert summary["contests_processed"] == 1  # only `finished`
    finished.refresh_from_db()
    active.refresh_from_db()
    assert finished.rating_applied is True
    assert active.rating_applied is False  # not finished → untouched
