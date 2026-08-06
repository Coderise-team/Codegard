import apps.users.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0006_oauthaccount"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_thumb",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=apps.users.models.user_avatar_thumb_upload_to,
            ),
        ),
    ]
