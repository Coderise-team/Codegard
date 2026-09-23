from apps.realtime.consumers.contest import ContestConsumer
from apps.realtime.consumers.notification import NotificationConsumer
from apps.realtime.consumers.submission import SubmissionConsumer
from django.urls import re_path

websocket_urlpatterns = [
    re_path(r"^ws/contests/(?P<contest_id>\d+)/$", ContestConsumer.as_asgi()),
    re_path(r"^ws/submissions/(?P<submission_id>\d+)/$", SubmissionConsumer.as_asgi()),
    # No id in the path: the audience is the connected user, taken from the
    # authenticated scope rather than the URL.
    re_path(r"^ws/notifications/$", NotificationConsumer.as_asgi()),
]
