"""Avatar tests: upload (endpoint cuts a master + 192px thumbnail, stores both,
returns the thumbnail URL) and cleanup (replace / clear / user-delete remove
BOTH files). The API serves only the thumbnail; the master stays server-side.
"""

import io
from unittest import mock

import pytest
from apps.users.admin import UserAdmin
from apps.users.images import THUMB_SIZE_PX, process_avatar
from apps.users.signals import (
    _delete_file,
    stash_old_avatar_on_change,
)
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from PIL import Image

AVATAR_URL = "/api/users/avatar/"


@pytest.fixture
def fs_storage(settings, tmp_path):
    """Swap the default storage to a throwaway FileSystem backend so tests can
    assert real file existence without touching R2."""
    settings.STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(tmp_path / "media")},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    return settings


def _image_upload(name="avatar.png", size=(400, 400), color=(255, 0, 0), fmt="PNG"):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt)
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type=f"image/{fmt.lower()}")


def _give_avatar(user, color=(255, 0, 0)):
    """Attach an avatar the same way the endpoint does: cut both files, assign
    both fields, save with the avatar update_fields."""
    master, thumb = process_avatar(_image_upload(color=color))
    user.avatar = master
    user.avatar_thumb = thumb
    user.save(update_fields=["avatar", "avatar_thumb"])
    return user


def _open_stored(field):
    with field.storage.open(field.name, "rb") as fh:
        return Image.open(io.BytesIO(fh.read()))


# --- upload -----------------------------------------------------------------


@pytest.mark.django_db
def test_upload_stores_both_files_and_returns_thumb(user_client, user, fs_storage):
    resp = user_client.post(AVATAR_URL, {"avatar": _image_upload()}, format="multipart")

    assert resp.status_code == 200
    assert resp.data["avatar"]
    assert "thumbnails" not in resp.data  # the old two-size block is gone

    user.refresh_from_db()
    assert user.avatar and user.avatar_thumb
    assert default_storage.exists(user.avatar.name)
    assert default_storage.exists(user.avatar_thumb.name)
    # The served URL is the thumbnail, not the master.
    assert user.avatar_thumb.name in resp.data["avatar"]


@pytest.mark.django_db
def test_thumbnail_is_192_webp_and_master_within_1024(user_client, user, fs_storage):
    resp = user_client.post(
        AVATAR_URL, {"avatar": _image_upload(size=(1600, 900))}, format="multipart"
    )
    assert resp.status_code == 200
    user.refresh_from_db()

    thumb = _open_stored(user.avatar_thumb)
    assert thumb.size == (THUMB_SIZE_PX, THUMB_SIZE_PX)
    assert thumb.format == "WEBP"

    master = _open_stored(user.avatar)
    assert max(master.size) <= 1024
    assert master.format == "WEBP"


@pytest.mark.django_db
def test_too_large_file_is_rejected(user_client):
    big = SimpleUploadedFile(
        "big.png", b"\x89PNG" + b"0" * (5 * 1024 * 1024 + 1), content_type="image/png"
    )
    resp = user_client.post(AVATAR_URL, {"avatar": big}, format="multipart")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_non_image_is_rejected(user_client):
    bad = SimpleUploadedFile(
        "evil.png", b"definitely not an image", content_type="image/png"
    )
    resp = user_client.post(AVATAR_URL, {"avatar": bad}, format="multipart")
    assert resp.status_code == 400


# --- cleanup: both files ----------------------------------------------------


@pytest.mark.django_db
def test_replace_deletes_both_old_files(user, fs_storage):
    _give_avatar(user, color=(255, 0, 0))
    old_master, old_thumb = user.avatar.name, user.avatar_thumb.name
    assert default_storage.exists(old_master)
    assert default_storage.exists(old_thumb)

    _give_avatar(user, color=(0, 255, 0))

    assert not default_storage.exists(old_master)
    assert not default_storage.exists(old_thumb)
    assert default_storage.exists(user.avatar.name)
    assert default_storage.exists(user.avatar_thumb.name)


@pytest.mark.django_db
def test_clear_deletes_both_files(user, fs_storage):
    _give_avatar(user)
    master, thumb = user.avatar.name, user.avatar_thumb.name

    user.avatar = None
    user.avatar_thumb = None
    user.save(update_fields=["avatar", "avatar_thumb"])

    assert not default_storage.exists(master)
    assert not default_storage.exists(thumb)


@pytest.mark.django_db
def test_user_delete_removes_both_files(user, fs_storage):
    _give_avatar(user)
    master, thumb = user.avatar.name, user.avatar_thumb.name

    user.delete()

    assert not default_storage.exists(master)
    assert not default_storage.exists(thumb)


# --- cleanup: guards & safety (preserved from the old suite) ----------------


@pytest.mark.django_db
def test_save_without_avatar_in_update_fields_skips_lookup(user, fs_storage):
    """A save() whose update_fields can't touch either avatar field must not run
    the old-file SELECT — the guard short-circuits first."""
    _give_avatar(user)

    User = get_user_model()
    with mock.patch.object(User.objects, "filter", wraps=User.objects.filter) as filt:
        user.first_name = "Updated"
        user.save(update_fields=["first_name"])

    filt.assert_not_called()


@pytest.mark.django_db
def test_failed_save_keeps_old_files(user, fs_storage):
    """Deletion happens in post_save, so if the save() fails after pre_save
    (post_save never fires), both old files must stay — the row still points
    to them."""
    _give_avatar(user)
    old_master, old_thumb = user.avatar.name, user.avatar_thumb.name

    # New avatar assigned, pre_save stashes the old files...
    master, thumb = process_avatar(_image_upload(color=(0, 0, 255)))
    user.avatar = master
    user.avatar_thumb = thumb
    stash_old_avatar_on_change(get_user_model(), user)

    # ...but the DB write "fails", so post_save (which deletes) never runs.
    assert default_storage.exists(old_master)
    assert default_storage.exists(old_thumb)
    stash = getattr(user, "_avatar_files_to_delete", None)
    assert stash and len(stash) == 2  # both files still pending deletion


def test_delete_file_noop_for_empty():
    with mock.patch.object(default_storage, "delete") as sd:
        _delete_file("")
        _delete_file(None)
    sd.assert_not_called()


def test_delete_file_swallows_storage_error(caplog):
    """A storage.delete failure is logged, never raised."""
    with (
        mock.patch.object(default_storage, "exists", return_value=True),
        mock.patch.object(default_storage, "delete", side_effect=OSError("disk fail")),
    ):
        _delete_file("avatars/x.webp")  # must not raise
    assert "Failed to delete avatar file" in caplog.text


# --- the API serves the thumbnail everywhere --------------------------------


@pytest.mark.django_db
def test_me_serves_thumbnail_url(user_client, user, fs_storage):
    _give_avatar(user)
    resp = user_client.get("/api/users/me/")
    assert resp.status_code == 200
    assert user.avatar_thumb.name in resp.data["avatar"]
    assert "thumbs" in resp.data["avatar"]  # thumbnail, not the master


@pytest.mark.django_db
def test_me_avatar_null_without_avatar(user_client, user):
    resp = user_client.get("/api/users/me/")
    assert resp.status_code == 200
    assert resp.data["avatar"] is None


@pytest.mark.django_db
def test_profile_serves_thumbnail_url(user_client, user, fs_storage):
    _give_avatar(user)
    resp = user_client.get(f"/api/users/{user.username}/")
    assert resp.status_code == 200
    assert user.avatar_thumb.name in resp.data["avatar"]
    assert "thumbs" in resp.data["avatar"]


@pytest.mark.django_db
def test_profile_avatar_null_without_avatar(user_client, user):
    resp = user_client.get(f"/api/users/{user.username}/")
    assert resp.status_code == 200
    assert resp.data["avatar"] is None


@pytest.mark.django_db
def test_standings_serves_thumbnail_url(user_client, user, fs_storage):
    _give_avatar(user)
    resp = user_client.get("/api/users/standings/")
    assert resp.status_code == 200
    assert user.avatar_thumb.name in resp.data["you"]["avatar"]
    assert "thumbs" in resp.data["you"]["avatar"]


@pytest.mark.django_db
def test_standings_avatar_null_without_avatar(user_client, user):
    resp = user_client.get("/api/users/standings/")
    assert resp.status_code == 200
    assert resp.data["you"]["avatar"] is None


# --- odds and ends ----------------------------------------------------------


@pytest.mark.django_db
def test_admin_clear_avatar_action_removes_both_files(user, other, fs_storage):
    """The admin 'Clear avatar' action nulls both fields; the cleanup signals
    then drop both files from storage. Users without an avatar are skipped."""
    _give_avatar(user)
    master, thumb = user.avatar.name, user.avatar_thumb.name
    # `other` has no avatar -> the action skips it (the empty-user branch).

    User = get_user_model()
    admin = UserAdmin(User, AdminSite())
    request = RequestFactory().post("/admin/")
    # message_user needs the messages framework wired up; the action's file
    # cleanup is what we're testing, so stub the user-facing message out.
    with mock.patch.object(admin, "message_user"):
        admin.clear_avatar(request, User.objects.filter(pk__in=[user.pk, other.pk]))

    user.refresh_from_db()
    assert not user.avatar
    assert not user.avatar_thumb
    assert not default_storage.exists(master)
    assert not default_storage.exists(thumb)


@pytest.mark.parametrize("mode", ["P", "L"])
def test_process_avatar_handles_non_rgb_modes(mode):
    """Palette (P) and grayscale (L) sources are normalised before encoding."""
    buf = io.BytesIO()
    Image.new(mode, (300, 300)).save(buf, format="PNG")
    buf.seek(0)
    upload = SimpleUploadedFile("x.png", buf.read(), content_type="image/png")

    _master, thumb = process_avatar(upload)
    assert Image.open(io.BytesIO(thumb.read())).format == "WEBP"


@pytest.mark.django_db
def test_stash_skips_when_old_row_is_missing(fs_storage):
    """pk is set but no such row exists (e.g. a forced-pk insert) -> the handler
    returns without stashing anything."""
    User = get_user_model()
    ghost = User(pk=999_999, username="ghost", email="ghost@test.com")
    ghost.avatar = "avatars/whatever.webp"

    stash_old_avatar_on_change(User, ghost)

    assert getattr(ghost, "_avatar_files_to_delete", None) is None
