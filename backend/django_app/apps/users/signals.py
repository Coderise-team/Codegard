"""
Avatar cleanup signals.

Keeps storage (R2 in prod) free of orphaned avatar files. Each user has two
files — the master (``avatar``) and the served thumbnail (``avatar_thumb``) —
and both can orphan when the avatar is replaced, cleared, or the user deleted.

A single pre_save handler covers every code path that changes the avatar (admin
replace, admin clear, API upload) because they all call User.save();
post_delete covers user deletion.
"""

import logging

from django.core.files.storage import default_storage
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import User

logger = logging.getLogger(__name__)

# Avatar fields that hold a storage file and therefore need cleanup.
_AVATAR_FIELDS = ("avatar", "avatar_thumb")


def _delete_file(file) -> None:
    """Delete one avatar file from storage.

    ``file`` may be an ImageFieldFile or a plain name string. Failures are
    logged but never raised, so cleanup can't block a save/delete.
    """
    if not file:
        return
    name = getattr(file, "name", file)
    try:
        if name and default_storage.exists(name):
            default_storage.delete(name)
    except Exception as exc:  # noqa: BLE001 - cleanup must never break the request
        logger.warning("Failed to delete avatar file %r from storage: %s", name, exc)


@receiver(post_delete, sender=User)
def delete_avatar_on_user_delete(sender, instance: User, **kwargs):
    """User removed -> delete both avatar files from storage."""
    for field in _AVATAR_FIELDS:
        _delete_file(getattr(instance, field))


# Attribute used to carry the orphaned old files from pre_save to post_save.
_STASH_ATTR = "_avatar_files_to_delete"


@receiver(pre_save, sender=User)
def stash_old_avatar_on_change(sender, instance: User, **kwargs):
    """
    Avatar replaced or cleared -> REMEMBER the old files (don't delete yet).

    We only delete in post_save, after the row is safely written, so a failed
    save() can never orphan the DB row from its (already deleted) files. The old
    files are stashed on the instance and picked up by delete_stashed_avatar.

    Covers admin replace, admin clear, and API upload (all call save()).
    """
    if not instance.pk:
        return  # brand-new user, nothing to replace

    # Skip the extra SELECT on saves that can't touch the avatar. The avatar API
    # (views.py) passes update_fields=["avatar", "avatar_thumb"]; frequent saves
    # like ELO updates (services.py) pass other fields and skip the lookup.
    update_fields = kwargs.get("update_fields")
    if update_fields is not None and not any(
        f in update_fields for f in _AVATAR_FIELDS
    ):
        return

    old = User.objects.filter(pk=instance.pk).only(*_AVATAR_FIELDS).first()
    if old is None:
        return

    stash = []
    for field in _AVATAR_FIELDS:
        old_file = getattr(old, field)
        if not old_file:
            continue
        new_file = getattr(instance, field)
        new_name = new_file.name if new_file else ""
        if old_file.name != new_name:
            # field changed (new file) or was cleared -> old file is orphaned.
            stash.append(old_file)
    if stash:
        setattr(instance, _STASH_ATTR, stash)


@receiver(post_save, sender=User)
def delete_stashed_avatar(sender, instance: User, **kwargs):
    """Row saved successfully -> now it's safe to delete the old files."""
    stash = getattr(instance, _STASH_ATTR, None)
    if stash:
        setattr(instance, _STASH_ATTR, None)  # clear first: no double-delete
        for old_file in stash:
            _delete_file(old_file)
