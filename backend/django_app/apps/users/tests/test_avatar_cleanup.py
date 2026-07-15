"""
Tests for avatar cleanup: when an avatar is replaced, cleared, or the user is
deleted, the source file is removed from storage and sorl's thumbnail cleanup
is triggered (the source's thumbnail references are dropped from the KV store).

Note on thumbnails: we assert thumbnail cleanup via sorl's KV store rather than
raw thumbnail-file existence. In tests we swap STORAGES to a temp FileSystem
backend, but sorl serializes the storage of each cached thumbnail at creation
time, so a deleted thumbnail's file may be looked up in a different location
than the test's default_storage. In production storage is constant (R2), so the
files themselves are removed. The KV-store assertion reliably proves that
`thumbnail_delete` ran and purged the thumbnail references.
"""

import io
from unittest import mock

import pytest
from apps.users.signals import _delete_avatar
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from sorl.thumbnail import default as sorl_default
from sorl.thumbnail import get_thumbnail
from sorl.thumbnail.images import ImageFile


@pytest.fixture
def fs_storage(settings, tmp_path):
    settings.STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(tmp_path / "media")},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    settings.THUMBNAIL_PREFIX = "thumbnails/"

    # sorl caches its storage/kvstore in module-level LazyObjects that don't
    # react to a per-test STORAGES swap. Reset them so sorl uses the test storage.
    from django.utils.functional import empty

    for attr in ("storage", "kvstore", "engine", "backend"):
        obj = getattr(sorl_default, attr)
        if hasattr(obj, "_wrapped"):
            obj._wrapped = empty
    return settings


def _image_file(name="avatar.png", color=(255, 0, 0)):
    buf = io.BytesIO()
    Image.new("RGB", (400, 400), color=color).save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


def _make_user_with_avatar(username, color=(255, 0, 0)):
    User = get_user_model()
    user = User.objects.create_user(
        username=username, email=f"{username}@test.com", password="pass"
    )
    user.avatar = _image_file(color=color)
    user.save()
    # Generate thumbnails so the source gets thumbnail references in the KV store.
    get_thumbnail(user.avatar, "128x128", crop="center", quality=85)
    get_thumbnail(user.avatar, "256x256", crop="center", quality=85)
    return user


def _source_has_thumbnail_refs(name: str) -> bool:
    """True if sorl still tracks thumbnails for the given source name."""
    return sorl_default.kvstore.get(ImageFile(name)) is not None


@pytest.mark.django_db
def test_old_avatar_and_thumbnails_deleted_on_replace(fs_storage):
    user = _make_user_with_avatar("u_replace")
    old_avatar = user.avatar.name

    assert default_storage.exists(old_avatar)
    assert _source_has_thumbnail_refs(old_avatar)

    user.avatar = _image_file(color=(0, 255, 0))
    user.save()

    assert not default_storage.exists(old_avatar)
    assert not _source_has_thumbnail_refs(old_avatar)
    assert default_storage.exists(user.avatar.name)


@pytest.mark.django_db
def test_avatar_and_thumbnails_deleted_on_clear(fs_storage):
    user = _make_user_with_avatar("u_clear")
    old_avatar = user.avatar.name

    assert default_storage.exists(old_avatar)
    assert _source_has_thumbnail_refs(old_avatar)

    user.avatar = None
    user.save()

    assert not default_storage.exists(old_avatar)
    assert not _source_has_thumbnail_refs(old_avatar)


@pytest.mark.django_db
def test_avatar_and_thumbnails_deleted_on_user_delete(fs_storage):
    user = _make_user_with_avatar("u_delete")
    old_avatar = user.avatar.name

    assert default_storage.exists(old_avatar)
    assert _source_has_thumbnail_refs(old_avatar)

    user.delete()

    assert not default_storage.exists(old_avatar)
    assert not _source_has_thumbnail_refs(old_avatar)


@pytest.mark.django_db
def test_save_without_avatar_in_update_fields_skips_lookup(fs_storage):
    """
    A save() whose update_fields can't touch the avatar (e.g. an ELO update)
    must not run the old-avatar SELECT — the guard short-circuits first.
    """
    user = _make_user_with_avatar("u_guard")

    User = get_user_model()
    with mock.patch.object(User.objects, "filter", wraps=User.objects.filter) as filt:
        user.first_name = "Updated"
        user.save(update_fields=["first_name"])

    filt.assert_not_called()


@pytest.mark.django_db
def test_failed_save_keeps_old_avatar(fs_storage):
    """
    Safety: deletion happens in post_save, so if the save() fails AFTER pre_save
    (post_save never fires), the old file must stay — the DB row still points to it.
    """
    from apps.users.signals import stash_old_avatar_on_change

    user = _make_user_with_avatar("u_fail")
    old_avatar = user.avatar.name
    assert default_storage.exists(old_avatar)

    # New avatar assigned, pre_save runs and stashes the old file...
    user.avatar = _image_file(color=(0, 0, 255))
    stash_old_avatar_on_change(get_user_model(), user)

    # ...but the DB write fails, so post_save (which deletes) is never called.
    assert default_storage.exists(old_avatar)  # old file untouched
    assert getattr(user, "_avatar_to_delete", None)  # still pending deletion


# --- _delete_avatar edge cases (error handling) ---


def test_delete_avatar_noop_for_empty():
    """Empty avatar -> early return, no storage calls."""
    with (
        mock.patch("apps.users.signals.thumbnail_delete") as td,
        mock.patch.object(default_storage, "delete") as sd,
    ):
        _delete_avatar("")
        _delete_avatar(None)
    td.assert_not_called()
    sd.assert_not_called()


def test_delete_avatar_swallows_thumbnail_error(caplog):
    """thumbnail_delete failure is logged, not raised."""
    with (
        mock.patch(
            "apps.users.signals.thumbnail_delete", side_effect=RuntimeError("boom")
        ),
        mock.patch.object(default_storage, "exists", return_value=False),
    ):
        _delete_avatar("avatars/x.png")  # must not raise
    assert "Failed to delete thumbnails" in caplog.text


def test_delete_avatar_swallows_storage_error(caplog):
    """default_storage.delete failure is logged, not raised."""
    with (
        mock.patch("apps.users.signals.thumbnail_delete"),
        mock.patch.object(default_storage, "exists", return_value=True),
        mock.patch.object(default_storage, "delete", side_effect=OSError("disk fail")),
    ):
        _delete_avatar("avatars/x.png")  # must not raise
    assert "Failed to delete avatar" in caplog.text
