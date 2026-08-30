"""Project-wide object builders for tests.

Plain functions (not fixtures): a test that builds several objects at once, or
needs one placed at a specific point on the clock, calls these instead of
threading a fixture through its signature. Single shared objects a test just
needs to exist are fixtures in ``conftest.py`` (global or per-app).

One builder per model, used across apps. They sit next to the project-wide
``conftest.py`` for the same reason its fixtures do: they are cross-app, so they
belong in one global place rather than copied into each app's tests.
"""

from datetime import timedelta

from apps.contests.models import Contest
from apps.problems.models import Problem, Tag
from apps.submissions.models import Submission
from django.contrib.auth import get_user_model
from django.utils import timezone


def make_problem(
    title="P",
    *,
    difficulty=Problem.Difficulty.EASY,
    description="",
    tags=(),
    is_hidden=False,
):
    """A published problem. ``time_limit``/``memory_limit`` fall back to the
    model defaults."""
    problem = Problem.objects.create(
        title=title,
        description=description,
        difficulty=difficulty,
        is_hidden=is_hidden,
    )
    for name in tags:
        problem.tags.add(Tag.objects.get_or_create(name=name)[0])
    return problem


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


def make_submission(
    user, problem, contest=None, verdict=Submission.Verdict.AC, *, created_at=None
):
    """A submission. Defaults to an AC (which fires the scoring signal); pass
    ``verdict=None`` for a pending one. ``created_at`` is set via ``update()``
    because the column is ``auto_now_add``."""
    submission = Submission.objects.create(
        user=user,
        problem=problem,
        contest=contest,
        code="x",
        language=Submission.Language.PYTHON,
        verdict=verdict,
    )
    if created_at is not None:
        Submission.objects.filter(pk=submission.pk).update(created_at=created_at)
        submission.created_at = created_at
    return submission


def make_user(username, elo, *, max_rating=None, is_active=True, is_staff=False):
    """An active leaderboard user with a set rating (peak defaults to current)."""
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="pass",
        elo_rating=elo,
        max_rating=max_rating if max_rating is not None else elo,
        is_active=is_active,
        is_staff=is_staff,
    )
