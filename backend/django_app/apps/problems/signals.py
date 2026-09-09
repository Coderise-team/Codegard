"""Reactions to a problem changing.

The only one so far: a problem entering the public catalog is news worth
telling people about. The trigger is the *transition* into visibility, not the
save — an admin fixing a typo on a problem that has been public for a month
must not send it round again.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Problem
from .notifications import announce_new_problems


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
