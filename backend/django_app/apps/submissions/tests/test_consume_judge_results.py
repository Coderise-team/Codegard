"""Tests for the judge-results consumer (consume_judge_results command)."""

from collections import defaultdict
from datetime import timedelta
from unittest.mock import patch

import pytest
from apps.contests.models import Contest
from apps.problems.models import Problem
from apps.submissions.management.commands.consume_judge_results import (
    DEAD_KEY,
    MAX_ATTEMPTS,
    PROCESSING_KEY,
    RESULTS_KEY,
    _attempts_key,
    apply_result,
    process_message,
    recover_orphans,
)
from apps.submissions.models import Submission
from django.utils import timezone
from schemas.response import SubmissionResponse, VerdictEnum


class _FakeRedis:
    """In-memory stand-in for redis, mirroring test_tasks.py's fake."""

    def __init__(self):
        self.lists = defaultdict(list)
        self.counters = {}

    def rpush(self, key, value):
        self.lists[key].append(value)

    def lrem(self, key, count, value):
        removed = 0
        out = []
        for v in self.lists[key]:
            if v == value and (count == 0 or removed < count):
                removed += 1
                continue
            out.append(v)
        self.lists[key] = out
        return removed

    def incr(self, key):
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    def expire(self, key, ttl):
        pass

    def delete(self, key):
        self.counters.pop(key, None)
        self.lists.pop(key, None)

    def lmove(self, first, second, src="LEFT", dest="LEFT"):
        if not self.lists[first]:
            return None
        value = self.lists[first].pop(0 if src == "LEFT" else -1)
        if dest == "LEFT":
            self.lists[second].insert(0, value)
        else:
            self.lists[second].append(value)
        return value


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(username="solver", password="pass")


@pytest.fixture
def problem(db):
    return Problem.objects.create(
        title="Sum",
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


@pytest.fixture
def active_contest(db):
    now = timezone.now()
    return Contest.objects.create(
        title="Live",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=2),
        status=Contest.Status.ACTIVE,
    )


def _pending(user, problem, contest=None):
    return Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="print(1)",
        language=Submission.Language.PYTHON,
    )


# --- Step 3: apply_result -------------------------------------------------


@pytest.mark.django_db
def test_apply_happy_path(user, problem):
    sub = _pending(user, problem)
    resp = SubmissionResponse(
        submission_id=sub.pk,
        verdict=VerdictEnum.AC,
        execution_time_ms=42,
        stderr="some warning",
    )
    found = apply_result(resp)

    assert found is True
    sub.refresh_from_db()
    assert sub.verdict == Submission.Verdict.AC
    assert sub.execution_time_ms == 42
    assert sub.stderr == "some warning"


@pytest.mark.django_db
def test_apply_dedup_skips_resave(user, problem):
    sub = _pending(user, problem)
    sub.verdict = Submission.Verdict.AC
    sub.save()

    resp = SubmissionResponse(submission_id=sub.pk, verdict=VerdictEnum.WA)
    with patch(
        "apps.submissions.signals._broadcast_submission_update"
    ) as mock_broadcast:
        found = apply_result(resp)

    assert found is True
    mock_broadcast.assert_not_called()
    sub.refresh_from_db()
    assert sub.verdict == Submission.Verdict.AC  # unchanged


@pytest.mark.django_db
def test_apply_missing_submission_returns_false(user, problem):
    resp = SubmissionResponse(submission_id=999999, verdict=VerdictEnum.AC)
    assert apply_result(resp) is False


@pytest.mark.django_db
def test_apply_triggers_score_recalc(user, problem, active_contest):
    active_contest.problems.add(problem)
    sub = _pending(user, problem, contest=active_contest)
    resp = SubmissionResponse(submission_id=sub.pk, verdict=VerdictEnum.AC)

    with patch("apps.submissions.signals.calculate_score") as mock_score:
        apply_result(resp)

    mock_score.assert_called_once_with(user, active_contest)


# --- Step 4: process_message ----------------------------------------------


def test_process_malformed_json_dead_letters():
    redis = _FakeRedis()
    raw = "{not json"
    redis.lists[PROCESSING_KEY] = [raw]

    process_message(redis, raw)

    assert redis.lists[DEAD_KEY] == [raw]
    assert raw not in redis.lists[PROCESSING_KEY]


@pytest.mark.django_db
def test_process_success_clears_processing(user, problem):
    sub = _pending(user, problem)
    raw = SubmissionResponse(
        submission_id=sub.pk, verdict=VerdictEnum.AC
    ).model_dump_json()
    redis = _FakeRedis()
    redis.lists[PROCESSING_KEY] = [raw]

    process_message(redis, raw)

    assert redis.lists[PROCESSING_KEY] == []
    assert redis.lists[DEAD_KEY] == []
    sub.refresh_from_db()
    assert sub.verdict == Submission.Verdict.AC


@pytest.mark.django_db
def test_process_unknown_submission_discarded_not_dead_lettered():
    raw = SubmissionResponse(
        submission_id=123456, verdict=VerdictEnum.AC
    ).model_dump_json()
    redis = _FakeRedis()
    redis.lists[PROCESSING_KEY] = [raw]

    process_message(redis, raw)  # must not raise

    assert redis.lists[PROCESSING_KEY] == []
    assert redis.lists[DEAD_KEY] == []


# --- Step 5: recover_orphans ----------------------------------------------


def test_recover_orphans_requeues_all():
    redis = _FakeRedis()
    redis.lists[PROCESSING_KEY] = ["a", "b"]

    recover_orphans(redis)

    assert redis.lists[PROCESSING_KEY] == []
    assert sorted(redis.lists[RESULTS_KEY]) == ["a", "b"]


# --- Step 4: transient failure → retry / dead-letter ----------------------

_CMD = "apps.submissions.management.commands.consume_judge_results"


@patch(f"{_CMD}.time.sleep")  # don't actually pause in tests
@patch(f"{_CMD}.apply_result", side_effect=RuntimeError("db down"))
def test_process_transient_failure_requeues_and_paces(_apply, _sleep):
    raw = SubmissionResponse(submission_id=7, verdict=VerdictEnum.AC).model_dump_json()
    redis = _FakeRedis()
    redis.lists[PROCESSING_KEY] = [raw]

    process_message(redis, raw)  # attempt 1 of MAX

    assert redis.lists[RESULTS_KEY] == [raw]  # requeued, not lost
    assert redis.lists[PROCESSING_KEY] == []
    assert redis.lists[DEAD_KEY] == []
    _sleep.assert_called_once()  # paced, not a hot spin


@patch(f"{_CMD}.time.sleep")
@patch(f"{_CMD}.apply_result", side_effect=RuntimeError("db down"))
def test_process_dead_letters_after_max_attempts(_apply, _sleep):
    raw = SubmissionResponse(submission_id=7, verdict=VerdictEnum.AC).model_dump_json()
    redis = _FakeRedis()
    redis.lists[PROCESSING_KEY] = [raw]
    # Pretend we've already failed MAX times → this call tips it over.
    redis.counters[_attempts_key(7)] = MAX_ATTEMPTS

    process_message(redis, raw)

    assert redis.lists[DEAD_KEY] == [raw]
    assert redis.lists[PROCESSING_KEY] == []
    assert redis.lists[RESULTS_KEY] == []  # not requeued
    assert _attempts_key(7) not in redis.counters  # counter cleaned up
