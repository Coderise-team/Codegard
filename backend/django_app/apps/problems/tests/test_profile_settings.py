from apps.users.tests.test_avatar import _give_avatar
from django.core.files.storage import default_storage
from rest_framework import status


def test_profile_empty_fields(db, user, user_client):
    user.refresh_from_db()

    assert user.avatar.name == ""
    assert user.avatar_thumb.name == ""
    assert user.bio == ""

    response = user_client.get("/api/users/me/")

    assert response.data["avatar"] is None


def test_profile_delete_photo(db, user, user_client):
    _give_avatar(user)
    old_avatar = user.avatar.name
    old_avatar_thumb = user.avatar_thumb.name

    response = user_client.delete("/api/users/avatar/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["avatar"] is None

    user.refresh_from_db()

    assert user.avatar.name == ""
    assert user.avatar_thumb.name == ""
    assert not default_storage.exists(old_avatar)
    assert not default_storage.exists(old_avatar_thumb)
