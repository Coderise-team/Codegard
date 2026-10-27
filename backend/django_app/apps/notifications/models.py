"""Storage for the notification bell.

One row per recipient (fan-out): a platform event that concerns ten people
writes ten rows. The alternative — one row per event plus a "who read it"
table — saves space on global announcements but turns the unread counter into
a JOIN and needs relevance logic on top; it starts paying off somewhere around
50-100k users, and at our scale it would be complexity bought for nothing.

The text is rendered once, at creation time, and stored as plain strings. The
feed is then a flat SELECT with no joins and no N+1, and a notification about a
since-deleted object still reads sensibly. ``link`` is likewise a stored string
and always an internal relative path (``/contests/15``) — never an external
URL, which is what keeps the bell from becoming an open-redirect surface.
"""

from django.conf import settings
from django.db import models


class Notification(models.Model):
    """One notification addressed to one user.

    ``seen_at`` is the single read-state: this is a feed, not a mailbox — a
    notification is read in full right where it sits, so "seen in the feed" is
    the only event worth recording. Tying it to a click instead would leave the
    counter burning forever for someone who reads everything and navigates
    nowhere.
    """

    class Type(models.TextChoices):
        RATING_CHANGED = "rating_changed", "Rating changed"
        RANK_CHANGED = "rank_changed", "Rank changed"
        CONTEST_STARTED = "contest_started", "Contest started"
        CONTEST_ENDED = "contest_ended", "Contest finished"
        CONTEST_STARTING_SOON = "contest_starting_soon", "Contest starting soon"
        NEW_PROBLEM = "new_problem", "New problem"
        REPORT_RESOLVED = "report_resolved", "Report reviewed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=32, choices=Type.choices)
    dedup_key = models.CharField(
        max_length=100,
        help_text="Event stamp this notification was born from. Together with "
        "(user, type) it is the uniqueness key, so a task that runs twice "
        "cannot deliver the same event twice.",
    )
    title = models.CharField(max_length=255)
    body = models.CharField(max_length=500)
    link = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Internal relative path (/problems/12), or empty when the "
        "target is gone and the row should not be clickable.",
    )
    seen_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the row was seen in the feed. NULL is what the unread "
        "counter counts.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # The dedup itself. Beat tasks overlap and workers restart, so the
            # same event is offered more than once; the database — not the
            # caller — is what makes delivery exactly-once.
            models.UniqueConstraint(
                fields=["user", "type", "dedup_key"],
                name="uniq_notification_dedup",
            )
        ]
        indexes = [
            # The unread counter: COUNT WHERE user=me AND seen_at IS NULL.
            models.Index(fields=["user", "seen_at"]),
            # The feed itself: newest first, one user at a time.
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user}: {self.title}"
