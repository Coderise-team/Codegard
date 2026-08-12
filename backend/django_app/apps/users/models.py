import uuid
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.postgres.indexes import GinIndex
from django.db import models


def user_avatar_upload_to(_instance, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    ext = ext if ext in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
    return f"avatars/{uuid.uuid4().hex}{ext}"


def user_avatar_thumb_upload_to(_instance, _filename: str) -> str:
    # The thumbnail is always re-encoded to WEBP, so the incoming filename's
    # extension is irrelevant — the name is fixed to .webp.
    return f"avatars/thumbs/{uuid.uuid4().hex}.webp"


class User(AbstractUser):
    """Platform account: auth plus the competitive-profile fields (avatar, bio,
    current and peak ELO rating)."""

    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to=user_avatar_upload_to, blank=True, null=True)
    avatar_thumb = models.ImageField(
        upload_to=user_avatar_thumb_upload_to, blank=True, null=True
    )
    bio = models.TextField(blank=True, null=True)
    elo_rating = models.IntegerField(default=1200, db_index=True)
    max_rating = models.IntegerField(default=1200, db_index=True)

    class Meta:
        indexes = [
            # Trigram GIN index backing the typo-tolerant username search.
            GinIndex(
                name="user_username_trgm",
                fields=["username"],
                opclasses=["gin_trgm_ops"],
            ),
        ]


class EloHistory(models.Model):
    """One point in a user's rating timeline — a rating snapshot at a moment,
    used to plot the ELO sparkline."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="elo_history",
    )
    rating = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.rating} ({self.created_at:%Y-%m-%d})"


class OAuthAccount(models.Model):
    """Link between a local user and an external OAuth identity.

    One row per (provider, provider_uid): the same Google/GitHub account
    always resolves to the same local user, no matter which email it shows.
    """

    class Provider(models.TextChoices):
        GOOGLE = "google", "Google"
        GITHUB = "github", "GitHub"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="oauth_accounts",
    )
    provider = models.CharField(max_length=16, choices=Provider.choices)
    provider_uid = models.CharField(max_length=191)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_uid"],
                name="uniq_oauth_provider_uid",
            )
        ]

    def __str__(self):
        return f"{self.user.username}: {self.provider}"
