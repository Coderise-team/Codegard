"""What the platform tells people about problems.

A problem becomes public in two different ways — an admin unhides one by hand,
or the batch task opens a finished contest's set — and both land here, so the
audience rules are written once instead of twice.
"""

from functools import partial

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone


def announce_new_problems(problems) -> None:
    """Announce problems that have just become visible in the catalog.

    Two audiences, because one of them has just spent two hours on these very
    problems. Everyone active hears about each problem by name; the people who
    played the contest a problem came out of get a single summary line about
    that contest instead. Without the split, the minute a round ends an entrant
    would receive "contest finished", a rating, possibly a rank, and then eight
    separate "new problem" notes about the problems they were just solving.

    Both paths use the key ``problem_<id>_new``, so a problem the batch task
    already announced stays silent if an admin later re-saves it — and a person
    who joined the platform in between does not get yesterday's news.
    """
    from apps.notifications.models import Notification
    from apps.notifications.services import create_bulk, notify_user

    problems = list(problems)
    if not problems:
        return

    now = timezone.now()
    audience = set(
        get_user_model().objects.filter(is_active=True).values_list("id", flat=True)
    )
    if not audience:
        return

    to_ring: set[int] = set()
    # Contest -> its participants, filled in as problems are walked. A contest
    # usually contributes several problems, and its entrants are the same set
    # every time.
    entrants: dict[int, set[int]] = {}
    contests: dict[int, object] = {}

    for problem in problems:
        insiders: set[int] = set()
        # Only finished contests: an entrant of a round still to come has
        # solved nothing yet, and "now in the catalog" would be nonsense.
        for contest in problem.contests.filter(end_time__lt=now):
            if contest.pk not in entrants:
                contests[contest.pk] = contest
                entrants[contest.pk] = set(
                    contest.participants.values_list("id", flat=True)
                )
            insiders |= entrants[contest.pk]

        to_ring |= create_bulk(
            audience - insiders,
            type=Notification.Type.NEW_PROBLEM,
            dedup_key=f"problem_{problem.pk}_new",
            title="New problem",
            body=f"{problem.title} is now available",
            link=f"/problems/{problem.pk}",
        )

    for contest_id, contest in contests.items():
        to_ring |= create_bulk(
            entrants[contest_id] & audience,
            type=Notification.Type.NEW_PROBLEM,
            dedup_key=f"contest_{contest_id}_problems_published",
            title="Contest problems published",
            body=f"Problems from {contest.title} are now in the catalog",
            link=f"/contests/{contest_id}",
        )

    # One doorbell per person for the whole batch, not one per problem.
    for user_id in to_ring:
        transaction.on_commit(partial(notify_user, user_id))
