"""Reactions to a submission's verdict changing.

When the judge writes a verdict onto a ``Submission``, these signal receivers
fan the change out to the rest of the platform: recompute the author's contest
score on a first AC, and push realtime updates over the WebSocket channel layer
(submission status, leaderboard, "problem solved" ticker). All broadcasts run in
``transaction.on_commit`` so nothing is sent until the DB write is durable.
"""

from apps.contests.services import calculate_score
from apps.realtime.events import ContestEvents, SubmissionEvents
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Submission


@receiver(pre_save, sender=Submission)
def _capture_previous_verdict(sender, instance: Submission, **kwargs):
    """Stash the pre-save verdict on the instance so post_save can tell whether
    it actually changed (and avoid re-scoring / re-broadcasting no-op saves)."""
    if not instance.pk:
        instance._previous_verdict = None
        return
    instance._previous_verdict = (
        Submission.objects.filter(pk=instance.pk)
        .values_list("verdict", flat=True)
        .first()
    )


@receiver(post_save, sender=Submission)
def _recalculate_contest_score_on_ac(
    sender, instance: Submission, created: bool, **kwargs
):
    """On the first accepted submission for a contest problem, recompute the
    author's contest score and broadcast the "problem solved" + leaderboard
    updates. Ignores non-contest submissions, non-AC verdicts, and repeat ACs."""
    if not instance.contest:
        return
    if instance.verdict != Submission.Verdict.AC:
        return

    previous_verdict = getattr(instance, "_previous_verdict", None)
    if not created and previous_verdict == Submission.Verdict.AC:
        return

    calculate_score(instance.user, instance.contest)
    contest = instance.contest
    transaction.on_commit(lambda: _broadcast_problem_solved(instance))
    transaction.on_commit(lambda: _broadcast_leaderboard(contest))


@receiver(post_save, sender=Submission)
def _broadcast_verdict_update(sender, instance: Submission, **kwargs):
    """Push the new verdict to whoever is watching this submission's socket —
    but only when the verdict actually changed (skip pending saves and no-ops)."""
    if instance.verdict is None:
        return
    previous_verdict = getattr(instance, "_previous_verdict", None)
    if previous_verdict == instance.verdict:
        return
    transaction.on_commit(lambda: _broadcast_submission_update(instance))


def _broadcast_submission_update(submission: Submission) -> None:
    """Send the verdict to the ``submission_<pk>`` channel group (the author's
    live submission view). No-op if the channel layer isn't configured."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"submission_{submission.pk}",
        {
            "type": SubmissionEvents.SUBMISSION_UPDATE,
            "submission_id": submission.pk,
            "verdict": submission.verdict,
        },
    )


def _broadcast_leaderboard(contest):
    """Recompute the ranked leaderboard and push it to the ``contest_<pk>``
    group so every viewer's standings refresh live. No-op without a channel layer."""
    from apps.contests.serializers import LeaderboardEntrySerializer
    from apps.contests.services import get_leaderboard
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    entries = list(get_leaderboard(contest))
    for rank, entry in enumerate(entries, start=1):
        entry.rank = rank
    data = list(LeaderboardEntrySerializer(entries, many=True).data)

    async_to_sync(channel_layer.group_send)(
        f"contest_{contest.pk}",
        {"type": ContestEvents.LEADERBOARD_UPDATE, "leaderboard": data},
    )


def _broadcast_problem_solved(submission: Submission) -> None:
    """Announce "<user> solved <problem>" to the ``contest_<pk>`` group for the
    live activity ticker. No-op if the channel layer isn't configured."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"contest_{submission.contest_id}",
        {
            "type": ContestEvents.PROBLEM_SOLVED,
            "username": submission.user.username,
            "problem_title": submission.problem.title,
        },
    )
