"""Reactions to a submission's verdict changing.

When the judge writes a verdict onto a ``Submission``, these signal receivers
fan the change out to the rest of the platform: recompute the author's contest
score on a first AC, push the verdict to the submission socket, and signal the
contest group that the standings moved (a bare signal — viewers refetch the
leaderboard over HTTP). All sends run in ``transaction.on_commit`` so nothing
leaves until the DB write is durable.
"""

from apps.contests.cache import bust_leaderboard_cache
from apps.contests.services import calculate_score
from apps.realtime.broadcast import group_send
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
    author's contest score and tell viewers the standings moved. Ignores
    non-contest submissions, non-AC verdicts, and repeat ACs."""
    if not instance.contest:
        return
    if instance.verdict != Submission.Verdict.AC:
        return

    previous_verdict = getattr(instance, "_previous_verdict", None)
    if not created and previous_verdict == Submission.Verdict.AC:
        return

    calculate_score(instance.user, instance.contest)
    contest = instance.contest

    def _publish():
        # Bust BEFORE signalling: clients refetch the moment the signal lands,
        # and a stale page served then would stick around for a whole TTL.
        bust_leaderboard_cache(contest.pk)
        _signal_leaderboard_changed(contest)

    transaction.on_commit(_publish)


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
    live submission view)."""
    group_send(
        f"submission_{submission.pk}",
        {
            "type": SubmissionEvents.SUBMISSION_UPDATE,
            "submission_id": submission.pk,
            "verdict": submission.verdict,
        },
    )


def _signal_leaderboard_changed(contest) -> None:
    """Tell the contest group the standings moved — without carrying them.

    The socket is a change notifier only: viewers refetch the paginated HTTP
    leaderboard themselves. Pushing the full table here would mean two shapes
    (flat list over WS, pages over HTTP) for one table on the frontend.
    """
    group_send(
        f"contest_{contest.pk}",
        {"type": ContestEvents.LEADERBOARD_UPDATE},
    )
