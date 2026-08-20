from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    # Enables PostgreSQL's pg_trgm extension, which provides the trigram
    # similarity functions and the gin_trgm_ops operator class the search
    # indexes rely on. Placed in `users` (the base app) so index migrations in
    # other apps can depend on it.
    dependencies = [
        ("users", "0007_user_avatar_thumb"),
    ]

    operations = [
        TrigramExtension(),
    ]
