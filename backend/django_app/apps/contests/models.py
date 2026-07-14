from django.conf import settings
from django.db import models
from django.utils import timezone


class Contest(models.Model):
    """A timed competitive round with its own problem set and participants.

    ``status`` is a cached mirror of the clock (pending/active/finished): it is
    recomputed from ``start_time``/``end_time`` on every save, so it can lag
    until the next write — time-sensitive logic should compare timestamps
    directly rather than trust the stored ``status``.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        FINISHED = "finished", "Finished"

    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, blank=True, default="")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    problems = models.ManyToManyField(
        "problems.Problem",
        blank=True,
        related_name="contests",
    )
    participants = models.ManyToManyField(
        "users.User",
        blank=True,
        related_name="contests",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    rating_applied = models.BooleanField(
        default=False,
        help_text="Whether ELO ratings have been awarded for this contest.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_time"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F("start_time")),
                name="check_start_before_end",
            )
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"

    def _compute_status(self, now):
        """Return the status implied by ``now`` vs the start/end window."""
        if now < self.start_time:
            return self.Status.PENDING
        if self.start_time <= now <= self.end_time:
            return self.Status.ACTIVE
        return self.Status.FINISHED

    def save(self, *args, **kwargs):
        """Persist the contest, refreshing ``status`` from the clock first.

        Side effect worth knowing: any save recomputes ``status`` from
        start/end times, so it can flip pending↔active↔finished implicitly.
        """
        # Ensure status is consistent at creation/update time.
        if self.start_time and self.end_time:
            self.status = self._compute_status(timezone.now())
        super().save(*args, **kwargs)

    def update_status(self):
        """Recalculate and save status based on current time."""
        new_status = self._compute_status(timezone.now())

        if self.status != new_status:
            self.status = new_status
            self.save(update_fields=["status"])


class ContestScore(models.Model):
    """
    Aggregated score for a user in a contest.
    Recalculated after every AC submission.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="contest_scores",
    )
    contest = models.ForeignKey(
        Contest,
        on_delete=models.CASCADE,
        related_name="scores",
    )
    score = models.IntegerField(default=0)
    penalty = models.IntegerField(
        default=0,
        help_text="Total penalty in minutes.",
    )
    solved_count = models.IntegerField(default=0)
    last_ac_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Time of last AC submission — used for tiebreaking.",
    )
    rating_delta = models.IntegerField(
        null=True,
        blank=True,
        help_text="Net rating change for this contest (filled by the ELO flow).",
    )
    rating_after = models.IntegerField(
        null=True,
        blank=True,
        help_text="User's rating after this contest (filled by the ELO flow).",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "contest")
        ordering = ["-score", "penalty", "last_ac_at"]

    def __str__(self):
        return (
            f"{self.user} in {self.contest} — score={self.score} penalty={self.penalty}"
        )
