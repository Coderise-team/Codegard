"""Migration 0010 rewrites NULL profile fields before making them NOT NULL.

Rows written before 0010 can hold NULL in avatar, avatar_thumb and bio. The
migration must turn them into empty strings first; otherwise tightening the
columns fails on a database that already has data.
"""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [("users", "0009_alter_user_options_user_user_username_trgm")]
AFTER = [("users", "0010_alter_user_avatar_alter_user_avatar_thumb_and_more")]


@pytest.mark.django_db(transaction=True)
def test_migration_turns_null_profile_fields_into_empty_strings():
    executor = MigrationExecutor(connection)
    executor.migrate(BEFORE)
    old_user = executor.loader.project_state(BEFORE).apps.get_model("users", "User")
    legacy = old_user.objects.create(
        username="legacy",
        email="legacy@test.com",
        avatar=None,
        avatar_thumb=None,
        bio=None,
    )

    executor = MigrationExecutor(connection)
    executor.migrate(AFTER)

    new_user = executor.loader.project_state(AFTER).apps.get_model("users", "User")
    migrated = new_user.objects.get(pk=legacy.pk)
    assert migrated.avatar.name == ""
    assert migrated.avatar_thumb.name == ""
    assert migrated.bio == ""
