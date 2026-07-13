import uuid
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


def user_avatar_upload_to(_instance, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    ext = ext if ext in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
    return f"avatars/{uuid.uuid4().hex}{ext}"


class User(AbstractUser):
    """Platform account: auth plus the competitive-profile fields (avatar, bio,
    current and peak ELO rating)."""

    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to=user_avatar_upload_to, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    elo_rating = models.IntegerField(default=1200)
    max_rating = models.IntegerField(default=1200)


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
