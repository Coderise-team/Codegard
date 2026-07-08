"""ASGI middleware that authenticates WebSocket connections via a one-time ticket.

Reads ``?ticket=<value>`` from the query string, redeems it against the cache
(which also deletes it, so it is single-use), and loads the matching user into
``scope["user"]``. Any failure — no ticket, unknown/expired ticket, or a missing
user — falls back to ``AnonymousUser`` without raising; the consumers decide what
to do (they close the socket with 4001 for anonymous users). The JWT is never
parsed here and never appears in the URL or logs.
"""

from urllib.parse import parse_qs

from apps.realtime.tickets import redeem_ticket
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

User = get_user_model()


@database_sync_to_async
def _get_user(user_id: int):
    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class TicketAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        scope["user"] = await self._resolve(scope)
        return await self.app(scope, receive, send)

    async def _resolve(self, scope):
        # Decode leniently: a malformed (non-UTF-8) query string must not raise
        # here — this middleware promises to fall back to AnonymousUser, never
        # to break the connection.
        query = parse_qs((scope.get("query_string") or b"").decode(errors="ignore"))
        ticket = query.get("ticket", [None])[0]
        # Cache access is blocking I/O — keep it off the event loop.
        user_id = await sync_to_async(redeem_ticket)(ticket)
        if user_id is None:
            return AnonymousUser()
        return await _get_user(user_id)
