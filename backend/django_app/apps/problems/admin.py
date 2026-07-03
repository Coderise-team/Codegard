"""Admin for the `problems` app — the content manager's main tool.

Problems are authored here (not via the API), so the admin must force a
*complete* problem: at least one test case and at least one tag. A problem
saved with zero test cases is dangerous — the judge iterates over the test
set, and on an empty set the loop never runs, leaving the verdict at its
default `AC`, so any submission "solves" the problem. We close that hole at
data-entry time by refusing to save an incomplete problem.
"""

from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet

from .models import DailyProblem, Problem, Tag, TestCase


class TestCaseInlineFormSet(BaseInlineFormSet):
    """Require at least one test case, checked in the formset's own clean().

    We don't rely on `min_num` + `validate_min`: Django 6's
    `InlineModelAdmin.get_formset` doesn't forward `validate_min` to the formset,
    so that combo silently doesn't enforce the minimum. Counting the surviving
    (non-empty, non-deleted) rows here is version-proof.
    """

    def clean(self):
        super().clean()
        if any(self.errors):
            return  # let per-row errors surface first
        live = sum(
            1
            for form in self.forms
            if getattr(form, "cleaned_data", None)
            and not form.cleaned_data.get("DELETE", False)
        )
        if live < 1:
            raise ValidationError("A problem must have at least one test case.")


class TestCaseInline(admin.TabularInline):
    """Inline editor for a problem's test cases, right on the problem form.

    `test_cases` is a reverse FK, so it never shows on the Problem form by
    itself — this inline surfaces it, and its formset enforces the "≥1 test
    case" rule.
    """

    model = TestCase
    formset = TestCaseInlineFormSet
    extra = 1
    # `note` is optional (blank=True); input/expected_output are the required
    # ones that make a row "count".
    fields = ("input", "expected_output", "is_hidden", "note")


class ProblemAdminForm(forms.ModelForm):
    """Problem form that requires at least one tag, with a clear message.

    We turn the field's own `required` off so `clean_tags` is the single gate:
    otherwise the default "This field is required." fires first and shadows our
    clearer "A problem must have at least one tag." message.
    """

    class Meta:
        model = Problem
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "tags" in self.fields:
            self.fields["tags"].required = False

    def clean_tags(self):
        tags = self.cleaned_data.get("tags")
        if not tags:
            raise ValidationError("A problem must have at least one tag.")
        return tags


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    """Problem admin: full content in grouped sections, tests inline, tags required.

    The `Tests` column makes zero-test problems obvious at a glance.
    """

    form = ProblemAdminForm
    inlines = [TestCaseInline]
    list_display = (
        "title",
        "difficulty",
        "tag_list",
        "test_case_count",
        "time_limit",
        "memory_limit",
        "created_at",
    )
    list_filter = ("difficulty", "tags")
    search_fields = ("title", "description")
    filter_horizontal = ("tags",)
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        # input_format / output_format / constraints are required TextFields on
        # the model (blank=False), so they MUST appear here — otherwise the form
        # hides required fields and the problem can never be saved.
        (
            None,
            {
                "fields": (
                    "title",
                    "description",
                    "input_format",
                    "output_format",
                    "constraints",
                    "difficulty",
                )
            },
        ),
        ("Limits", {"fields": ("time_limit", "memory_limit")}),
        ("Classification", {"fields": ("tags",)}),
        ("Metadata", {"fields": ("created_at", "updated_at")}),
    )

    def get_queryset(self, request):
        # Prefetch so the tag_list / test_case_count columns don't do a query
        # per row in the changelist.
        return super().get_queryset(request).prefetch_related("tags", "test_cases")

    @admin.display(description="Tags")
    def tag_list(self, obj):
        return ", ".join(t.name for t in obj.tags.all()) or "—"

    @admin.display(description="Tests")
    def test_case_count(self, obj):
        # len(prefetched .all()) uses the prefetch cache; .count() would ignore
        # it and hit the DB once per row (N+1 in the changelist).
        return len(obj.test_cases.all())


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Tags list/search + creation (also powers the "＋" button on the problem form)."""

    list_display = ("name",)
    search_fields = ("name",)


@admin.register(DailyProblem)
class DailyProblemAdmin(admin.ModelAdmin):
    """Assign/inspect the daily challenge by hand (date → problem)."""

    list_display = ("date", "problem")
    date_hierarchy = "date"
    autocomplete_fields = ("problem",)
