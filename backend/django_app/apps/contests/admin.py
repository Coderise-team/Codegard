from django.contrib import admin

from .models import Contest


class ProblemInline(admin.TabularInline):
    model = Contest.problems.through
    extra = 1
    verbose_name = "Problem"
    verbose_name_plural = "Problems"


@admin.register(Contest)
class ContestAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "start_time", "end_time", "rating_applied")
    list_filter = ("status", "rating_applied")
    search_fields = ("title",)
    date_hierarchy = "start_time"
    # Removed "problems" from filter_horizontal so we can use Inline instead
    filter_horizontal = ("participants",)
    ordering = ("-start_time",)
    inlines = [ProblemInline]
    exclude = ("problems",)  # Exclude the main M2M field so it doesn't show twice
