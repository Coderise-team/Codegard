from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Profile", {"fields": ("avatar", "avatar_thumb")}),
    )
    list_display = ("username", "email", "elo_rating", "max_rating", "is_staff")
    list_filter = ("is_staff", "is_active")
    search_fields = ("username", "email")
    ordering = ("-elo_rating",)
    # Avatars are set by users through the API, not uploaded here — view only.
    readonly_fields = DjangoUserAdmin.readonly_fields + ("avatar", "avatar_thumb")
    actions = ["clear_avatar"]

    @admin.action(description="Clear avatar")
    def clear_avatar(self, request, queryset):
        """Moderation action: drop both avatar files. The cleanup signals delete
        the actual files from storage once the row is saved."""
        cleared = 0
        for user in queryset:
            if not (user.avatar or user.avatar_thumb):
                continue
            user.avatar = None
            user.avatar_thumb = None
            user.save(update_fields=["avatar", "avatar_thumb"])
            cleared += 1
        self.message_user(request, f"Cleared {cleared} avatar(s).")
