"""Reactions to a problem, or a report about one, changing.

Both receivers here fire on a *transition* rather than on a save: a problem
becoming visible, and a report being judged. An admin fixing a typo on a
month-old public problem, or reopening the report form to read it, must not
send anything round again — so each pair stashes the stored value in
``pre_save`` and compares against it afterwards.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Problem, ProblemReport
from .notifications import (
    announce_new_problems,
    announce_report_resolved,
)


@receiver(pre_save, sender=Problem)
def _capture_previous_visibility(sender, instance: Problem, **kwargs):
    """Stash the stored visibility so post_save can tell a reveal from an edit."""
    if not instance.pk:
        # A problem that does not exist yet was never on show.
        instance._was_hidden = True
        return
    instance._was_hidden = (
        Problem.objects.filter(pk=instance.pk)
        .values_list("is_hidden", flat=True)
        .first()
    )


@receiver(post_save, sender=Problem)
def _announce_a_problem_entering_the_catalog(sender, instance: Problem, **kwargs):
    """Announce a problem the moment it becomes visible, and only then.

    A hidden problem is never announced under any circumstances — that is the
    statement leak this guard exists for, the same one fixed in
    ``fix/pre-launch-leaks``. Announcing on every save instead of on the
    transition would be worse than noisy: the creation service treats "has no
    row yet" as "is new to this", so a later edit would deliver a long-public
    problem to everyone who has joined since.
    """
    if instance.is_hidden:
        return
    if not getattr(instance, "_was_hidden", True):
        return  # already public; this save changed something else

    announce_new_problems([instance])


@receiver(pre_save, sender=ProblemReport)
def _capture_previous_status(sender, instance: ProblemReport, **kwargs):
    """Stash the stored status so post_save can tell a review from a re-save."""
    if not instance.pk:
        instance._previous_status = None
        return
    instance._previous_status = (
        ProblemReport.objects.filter(pk=instance.pk)
        .values_list("status", flat=True)
        .first()
    )


@receiver(post_save, sender=ProblemReport)
def _announce_a_reviewed_report(sender, instance: ProblemReport, **kwargs):
    """Announce the moment a pending report is judged, and only then.

    The one path into this is a staff member changing the status in the admin,
    so the transition worth catching is ``new`` -> accepted/rejected. Anything
    else — a report saved again, a note edited, a resolution revisited — has
    already been reported to its author.
    """
    if instance.status == ProblemReport.Status.NEW:
        return
    if getattr(instance, "_previous_status", None) != ProblemReport.Status.NEW:
        return

    announce_report_resolved(instance)
