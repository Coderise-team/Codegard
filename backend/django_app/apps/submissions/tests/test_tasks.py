import json

import pytest
from apps.problems.models import Problem, TestCase
from apps.submissions.models import Submission
from apps.submissions.tasks import JUDGE_QUEUE_KEY, push_to_judge_queue
from schemas import SubmissionRequest

# redis (fakeredis) comes from conftest.


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(username="user", password="pass")


@pytest.mark.django_db
def test_push_to_judge_queue_uses_shared_submission_request_schema(
    monkeypatch, redis, user
):
    problem = Problem.objects.create(
        title="Two Sum",
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=2000,
        memory_limit=256,
    )
    TestCase.objects.create(
        problem=problem,
        input="1\n",
        expected_output="1\n",
        is_hidden=False,
    )
    TestCase.objects.create(
        problem=problem,
        input="2\n",
        expected_output="2\n",
        is_hidden=True,
    )

    submission = Submission.objects.create(
        user=user,
        problem=problem,
        code="print('hello')",
        language=Submission.Language.PYTHON,
    )

    from apps.submissions import tasks

    monkeypatch.setattr(tasks, "get_redis_client", lambda: redis)

    ok = push_to_judge_queue(submission)
    assert ok is True

    queued = redis.lrange(JUDGE_QUEUE_KEY, 0, -1)
    assert len(queued) == 1

    data = json.loads(queued[0])
    req = SubmissionRequest(**data)

    assert req.submission_id == submission.pk
    assert req.language == submission.language
    assert req.code == submission.code
    assert req.time_limit_ms == problem.time_limit
    assert req.memory_limit_mb == problem.memory_limit
    assert len(req.test_cases) == 2
