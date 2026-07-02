from django.db import models


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Problem(models.Model):
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.difficulty})"


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
