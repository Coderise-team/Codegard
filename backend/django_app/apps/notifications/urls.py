from django.urls import path

from .views import MarkSeenView, NotificationListView, UnreadCountView

app_name = "notifications"

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("unread-count/", UnreadCountView.as_view(), name="notification-unread-count"),
    path("seen/", MarkSeenView.as_view(), name="notification-seen"),
]
