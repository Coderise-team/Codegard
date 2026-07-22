"""Object builders for the contests tests.

``conftest.py`` covers the single shared objects a test just needs to exist;
these plain functions are for tests that build several objects at once, or need
them placed at a specific point on the clock. They are called, not injected, so
a test's signature stays about what the test is really about.
"""

from datetime import timedelta

from apps.contests.models import Contest
from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.utils import timezone


def make_problem(title="P"):
    return Problem.objects.create(
        title=title,
        description="",
        difficulty=Problem.Difficulty.EASY,
        time_limit=1000,
        memory_limit=256,
    )


def make_contest(title="C", *, starts_in=-1, ends_in=1, **extra):
    """Contest whose start/end are `starts_in`/`ends_in` hours from now.

    The defaults land on a running contest. ``status`` is not passed: ``save()``
    recomputes it from those times anyway (a test that checks exactly that
    override can still force one through ``**extra``).
    """
    now = timezone.now()
    return Contest.objects.create(
        title=title,
        start_time=now + timedelta(hours=starts_in),
        end_time=now + timedelta(hours=ends_in),
        **extra,
    )


def make_submission(user, problem, contest, verdict=Submission.Verdict.AC):
    """A judged submission. An AC one fires the scoring signal."""
    return Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )
