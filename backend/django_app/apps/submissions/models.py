from django.conf import settings
from django.db import models
from schemas.request import LanguageEnum
from schemas.response import VerdictEnum


class Submission(models.Model):
    """One code submission to a problem (optionally within a contest).

    Created with an empty ``verdict``; the judge fills the verdict and run
    metrics later, and the ``post_save`` signals fan that out (score recalc +
    realtime updates).
    """

    class Language(models.TextChoices):
        PYTHON = LanguageEnum.PYTHON.value, "Python"

    class Verdict(models.TextChoices):
        AC = VerdictEnum.AC.value, "Accepted"
        WA = VerdictEnum.WA.value, "Wrong Answer"
        TLE = VerdictEnum.TLE.value, "Time Limit Exceeded"
        MLE = VerdictEnum.MLE.value, "Memory Limit Exceeded"
        OLE = VerdictEnum.OLE.value, "Output Limit Exceeded"
        RE = VerdictEnum.RE.value, "Runtime Error"
        CE = VerdictEnum.CE.value, "Compilation Error"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    problem = models.ForeignKey(
        "problems.Problem",
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    contest = models.ForeignKey(
        "contests.Contest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submissions",
    )
    code = models.TextField()
    language = models.CharField(
        max_length=20,
        choices=Language.choices,
    )
    verdict = models.CharField(
        max_length=3,
        choices=Verdict.choices,
        null=True,
        blank=True,
        default=None,
        help_text="Null until judge processes the submission.",
    )
    execution_time_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Execution time in milliseconds.",
    )
    memory_used_mb = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Memory used in megabytes.",
    )
    stderr = models.TextField(
        null=True,
        blank=True,
        help_text="Captured stderr of the user's program (RE/CE diagnostics).",
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text="Internal judge error message if the run failed before a verdict.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Speeds up the activity-heatmap query (filter by user + created_at
            # range, group by day) and any per-user submission lookups.
            models.Index(fields=["user", "created_at"]),
            # Catalog "solved?" Exists(user+problem) run per row.
            models.Index(fields=["user", "problem"], name="sub_user_problem"),
            # Catalog acceptance rate: all subs of a problem + AC count, per row.
            models.Index(fields=["problem", "verdict"], name="sub_problem_verdict"),
            # Contest "how many solved this problem": subs by contest + verdict.
            models.Index(fields=["contest", "verdict"], name="sub_contest_verdict"),
        ]

    def __str__(self):
        verdict = self.verdict or "Pending"
        return f"Submission #{self.pk} by {self.user} — {verdict}"
