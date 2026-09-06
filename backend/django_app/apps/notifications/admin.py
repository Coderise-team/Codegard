"""Admin for the `notifications` app — a read-only window, not an editor.

Notifications are written by the platform itself (rating runs, contest tasks,
signals), never by hand: a row typed in here would carry a ``dedup_key`` that
matches no real event, and editing one would rewrite history a user has
already seen. So the admin exists purely to look — to answer "did this
actually go out, and to whom" when something looks wrong.
"""

from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "type", "title", "seen_at", "created_at")
    list_filter = ("type",)
    search_fields = ("user__username", "title", "dedup_key")
    readonly_fields = (
        "user",
        "type",
        "dedup_key",
        "title",
        "body",
        "link",
        "seen_at",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
