from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import models


class Tag(models.Model):
    """A topic label (e.g. "dp", "graphs") attached to problems for filtering."""

    name = models.CharField(max_length=50, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Problem(models.Model):
    """A single algorithmic task: statement, limits, difficulty, tags, and the
    test cases the judge runs a submission against."""

    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    title = models.CharField(max_length=255)
    description = models.TextField()
    input_format = models.TextField(
        default="",
        help_text="Input format section of the statement.",
    )
    output_format = models.TextField(
        default="",
        help_text="Output format section of the statement.",
    )
    constraints = models.TextField(
        default="",
        help_text="One constraint per line; the frontend renders them as a list.",
    )
    difficulty = models.CharField(
        max_length=10,
        choices=Difficulty.choices,
        default=Difficulty.EASY,
    )
    time_limit = models.PositiveIntegerField(
        help_text="Time limit in milliseconds",
        default=1000,
    )
    memory_limit = models.PositiveIntegerField(
        help_text="Memory limit in megabytes",
        default=256,
    )
    tags = models.ManyToManyField(Tag, related_name="problems")
    is_hidden = models.BooleanField(
        default=True,
        help_text=(
            "Hidden problems stay out of the public catalog. New problems start "
            "hidden; a problem is unhidden automatically once a contest that "
            "uses it has finished."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Trigram GIN index backing the typo-tolerant title search.
            GinIndex(
                name="problem_title_trgm",
                fields=["title"],
                opclasses=["gin_trgm_ops"],
            ),
            # Catalog default sort is -created_at.
            models.Index(fields=["created_at"], name="problem_created_at"),
        ]

    def __str__(self):
        return f"{self.title} ({self.difficulty})"


class ProblemReport(models.Model):
    """A user-submitted complaint about a problem (bad statement, wrong test,
    wrong limits, an improvement idea, or something else).

    Outlives both the problem and the author: both FKs are SET_NULL, so a
    report is never wiped out by deleting the thing it points at — it's both
    a record of what went wrong and a safeguard against accidental deletion of
    a problem that's under discussion. ``problem_title`` is a snapshot taken
    at submission time so a report about a since-deleted (or renamed) problem
    still reads sensibly.
    """

    class Reason(models.TextChoices):
        STATEMENT = "statement", "Mistake in the statement"
        WRONG_TEST = "wrong_test", "Wrong test"
        WRONG_LIMITS = "wrong_limits", "Wrong limits"
        IMPROVEMENT = "improvement", "Suggest an improvement"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        NEW = "new", "New"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    problem = models.ForeignKey(
        Problem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
        help_text="SET_NULL: deleting the problem must not delete the report "
        "that documents what was wrong with it.",
    )
    problem_title = models.CharField(
        max_length=255,
        help_text="Snapshot of the problem's title at submission time. Not "
        "updated on rename, and stays readable after the problem is deleted.",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="problem_reports",
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    message = models.TextField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.NEW,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_problem_reports",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # The per-user-per-problem open-report count (decision 5) filters
            # on exactly these three columns.
            models.Index(fields=["user", "problem", "status"]),
            # The staff queue: filter by status, newest first.
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"Report #{self.pk} on '{self.problem_title}' ({self.status})"


class DailyProblem(models.Model):
    """One problem assigned as the daily challenge for a calendar day (UTC).

    Thin date->problem link, shared by all users. A row is created once per day
    by the `assign_daily_problem` beat task; `unique` on `date` both indexes the
    column and guarantees the task is idempotent (no duplicate days).
    """

    date = models.DateField(unique=True)
    problem = models.ForeignKey(
        Problem,
        on_delete=models.PROTECT,
        related_name="daily_assignments",
        help_text="PROTECT: a problem that was ever a daily challenge can't be "
        "deleted, so past streaks stay intact.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.date}: {self.problem.title}"


class TestCase(models.Model):
    """One input/expected-output pair for a problem. Visible cases are shown as
    examples in the statement; hidden ones are used only by the judge."""

    __test__ = False

    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="test_cases",
    )
    input = models.TextField()
    expected_output = models.TextField()
    note = models.TextField(
        blank=True,
        default="",
        help_text="Optional note shown under a sample example "
        "(visible test cases only).",
    )
    is_hidden = models.BooleanField(
        default=False,
        help_text="Hidden test cases are only used by the judge, not shown to users.",
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"TestCase #{self.pk} for '{self.problem.title}'"
