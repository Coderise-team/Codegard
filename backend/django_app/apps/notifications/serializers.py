"""Serializers for the notification feed.

The feed is read-only and pre-rendered: ``title``, ``body`` and ``link`` were
computed once, when the event happened, so there is nothing to build here and
nothing to join — the list is a flat SELECT over one table.
"""

from rest_framework import serializers

from .models import Notification

# Upper bound on one /seen/ call. The feed page caps at 50, but the client
# batches what scrolled past between flushes, so the honest limit is "a long
# session's worth", not "one page". It exists only to keep a single request
# from turning into an unbounded IN-list.
MAX_SEEN_IDS = 1000


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "link", "seen_at", "created_at"]


class MarkSeenSerializer(serializers.Serializer):
    """Body of ``POST /seen/``: the rows that were actually on screen.

    Which ids those are is the client's call — it watches the feed with an
    IntersectionObserver — so the server only checks the shape. An empty list is
    valid and simply marks nothing: the caller still gets the current count back.
    """

    ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=True,
        max_length=MAX_SEEN_IDS,
    )
