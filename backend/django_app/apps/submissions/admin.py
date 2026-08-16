"""Admin for submissions — a read-only window into what people sent.

Submissions are never authored or edited here: the code comes from the user
and the verdict from the judge. Editing either by hand would rewrite history
(scores and penalties are recomputed from these rows), so every field is
view-only and adding rows is disabled.
"""

from django.contrib import admin

from .models import Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "problem",
        "contest",
        "language",
        "verdict",
        "execution_time_ms",
        "created_at",
        "username",
        "email",
        "elo_rating",
        "max_rating",
        "is_staff"
    )
    list_filter = ("verdict", "language", "created_at", "is_staff", "is_active")
    search_fields = ("user__username", "problem__title", "username", "email")
    date_hierarchy = "created_at"
    ordering = ("-created_at", "-elo_rating",)
    # Heavy foreign keys: a dropdown would load every user and problem.
    raw_id_fields = ("user", "problem", "contest")
    readonly_fields = tuple(f.name for f in Submission._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False