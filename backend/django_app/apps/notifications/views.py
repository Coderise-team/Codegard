"""The three endpoints behind the bell: the feed, the counter, and "I saw these".

Every one of them is scoped to ``request.user`` and nothing else — a
notification is addressed to exactly one person, so there is no such thing as
reading someone else's, not even by guessing an id.
"""

from core.pagination import ClientPageSizePagination
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import MarkSeenSerializer, NotificationSerializer


def _unread_count(user) -> int:
    """How many rows the badge should show: the unseen ones.

    A plain COUNT, uncached, served by the ``(user, seen_at)`` index — one cheap
    aggregate, not an N+1. Caching it would buy invalidation work in every place
    a notification is born or dimmed, for a number that changes constantly.
    """
    return Notification.objects.filter(user=user, seen_at__isnull=True).count()


class NotificationListView(ListAPIView):
    """GET /api/notifications/ — the feed, newest first, paginated."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ClientPageSizePagination

    def get_queryset(self):
        # Newest first with a constant `id` tiebreaker, same as the report
        # queue: a fan-out writes many rows in one instant, and rows sharing a
        # timestamp would otherwise shuffle between pages. Here that is worse
        # than cosmetic — the client dims what it has seen by id, so a row that
        # shuffles across a page boundary is never shown and never dimmed.
        return Notification.objects.filter(user=self.request.user).order_by(
            "-created_at", "id"
        )


class UnreadCountView(APIView):
    """GET /api/notifications/unread-count/ — the number on the bell."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"count": _unread_count(request.user)})


class MarkSeenView(APIView):
    """POST /api/notifications/seen/ — dim the rows that were actually on screen.

    Only the ids the client passes, never "everything": a page hands over 20
    rows and maybe 15 of them fit on screen, so dimming the whole feed would
    quietly burn notifications the person never laid eyes on.

    Answers with the new unread count rather than an empty 204, because after a
    look at the feed that number is not necessarily zero — 50 unseen minus the
    20 just read leaves 30, and that remainder is the client's cue to keep
    scrolling.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MarkSeenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        now = timezone.now()
        if ids:
            # `created_at__lte=now` is the race guard: a notification that lands
            # while this request is in flight must not be swallowed by it. It
            # simply misses this sweep and shows up unseen, as it should.
            Notification.objects.filter(
                user=request.user,
                id__in=ids,
                seen_at__isnull=True,
                created_at__lte=now,
            ).update(seen_at=now)

        return Response({"count": _unread_count(request.user)})
