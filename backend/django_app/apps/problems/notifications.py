"""What the platform tells people about problems.

A problem becomes public in two different ways — an admin unhides one by hand,
or the batch task opens a finished contest's set — and both land here, so the
audience rules are written once instead of twice.
"""

import hashlib
from functools import partial

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Problem


def _summary_key(contest_id: int, problem_ids) -> str:
    """Dedup key for one contest's "problems published" summary.

    The batch of problems is folded into the key, so re-offering the same batch
    stays silent while a later batch for the same contest is a genuinely new
    summary. Keying on the contest alone used to lose those later problems
    outright: entrants are excluded from the per-problem rows, so once a contest
    had been summarised once, a problem attached to it afterwards reached them
    through neither route. A digest rather than the ids themselves because the
    column holds 100 characters and a contest may publish many problems.
    """
    fingerprint = ",".join(str(pk) for pk in sorted(problem_ids))
    digest = hashlib.sha256(fingerprint.encode()).hexdigest()[:12]
    return f"contest_{contest_id}_problems_published_{digest}"


def announce_new_problems(problems) -> None:
    """Announce problems that have just become visible in the catalog.

    Two audiences, because one of them has just spent two hours on these very
    problems. Every active player hears about each problem by name (staff are
    left out: they are the ones publishing it); the people who
    played the contest a problem came out of get a single summary line about
    that contest instead. Without the split, the minute a round ends an entrant
    would receive "contest finished", a rating, possibly a rank, and then eight
    separate "new problem" notes about the problems they were just solving.

    Both paths use the key ``problem_<id>_new``, so a problem reaching the
    catalog through both of them is still announced once. A later re-save of a
    problem that is already public is stopped earlier, by the signal's
    transition check — the key alone would not stop it, since someone who
    joined in between has no row yet and would get yesterday's news.
    """
    from apps.notifications.models import Notification
    from apps.notifications.services import create_bulk, notify_users

    problem_ids = [problem.pk for problem in problems]
    if not problem_ids:
        return

    now = timezone.now()
    audience = set(
        get_user_model()
        .objects.filter(is_active=True, is_staff=False)
        .values_list("id", flat=True)
    )
    if not audience:
        return

    # Re-read with the contests attached: walking `problem.contests` inside the
    # loop cost one query per problem for what is usually the same single
    # contest. The finished ones are picked out in Python afterwards, which
    # keeps this to one prefetch instead of one filtered query each.
    problems = list(
        Problem.objects.filter(pk__in=problem_ids).prefetch_related("contests")
    )

    to_ring: set[int] = set()
    # Contest -> its participants, and -> the problems of this batch that came
    # out of it. A contest usually contributes several problems, and its
    # entrants are the same set every time.
    entrants: dict[int, set[int]] = {}
    contests: dict[int, object] = {}
    covered: dict[int, list[int]] = {}

    for problem in problems:
        insiders: set[int] = set()
        for contest in problem.contests.all():
            # Only finished contests: an entrant of a round still to come has
            # solved nothing yet, and "now in the catalog" would be nonsense.
            if contest.end_time >= now:
                continue
            if contest.pk not in entrants:
                contests[contest.pk] = contest
                covered[contest.pk] = []
                entrants[contest.pk] = set(
                    contest.participants.values_list("id", flat=True)
                )
            covered[contest.pk].append(problem.pk)
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
            dedup_key=_summary_key(contest_id, covered[contest_id]),
            title="Contest problems published",
            body=f"Problems from {contest.title} are now in the catalog",
            link=f"/contests/{contest_id}",
        )

    # One doorbell per person for the whole batch, not one per problem.
    transaction.on_commit(partial(notify_users, to_ring))


# The user-facing word for each resolution. Kept separate from the column value
# so the copy can change without a data migration, and so a status that is not
# a resolution can never leak into the text.
_REPORT_OUTCOMES = {
    "accepted": "accepted",
    "rejected": "rejected",
}


def _report_link(report) -> str:
    """Where the notification about a judged report should lead.

    The problem's own page, normally. Two exceptions:

    - The problem is gone. A report outlives the problem it was about (the FK
      is SET_NULL), and there is nowhere to send the reader, so the row simply
      stops being clickable while the text still names what it was about.
    - The report was filed from a round that is still running. Its problems
      stay hidden from the catalog until the round ends, so ``/problems/<id>``
      answers 404 for the reader, while the round's own page shows the problem
      to its entrants. The round is where the reader can actually see it.
      Decided when the notification is written, like its text: once the round
      ends and the problem is published, the link still leads to the round,
      which lists that problem.
    """
    if report.problem_id is None:
        return ""
    if report.contest_id is not None and report.problem.is_hidden:
        return f"/contests/{report.contest_id}"
    return f"/problems/{report.problem_id}"


def announce_report_resolved(report) -> None:
    """Tell the person who filed a report how it was judged.

    The verdict is the whole message — it is what they opened the notification
    for — so it goes in the body rather than being implied by the title.

    The title of the problem always comes from the report's own snapshot, not
    from the live row. That keeps one text template instead of two, and leaves
    ``problem`` to be checked in exactly one place: the link — see
    ``_report_link``.
    """
    from apps.notifications.models import Notification
    from apps.notifications.services import create_notification, notify_users

    outcome = _REPORT_OUTCOMES.get(report.status)
    if outcome is None:
        return

    # The author's account can be gone (SET_NULL): there is nobody to tell, and
    # that is not an error.
    if report.user_id is None:
        return

    _, created = create_notification(
        user=report.user,
        type=Notification.Type.REPORT_RESOLVED,
        dedup_key=f"report_{report.pk}_{report.status}",
        title="Report reviewed",
        body=f"Your report on {report.problem_title} was {outcome}",
        link=_report_link(report),
    )
    if created:
        transaction.on_commit(partial(notify_users, [report.user_id]))
