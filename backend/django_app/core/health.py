"""Service health endpoint for container health checks.

Answers 200 only when the pieces the app cannot work without — the database
and the cache — actually respond. A plain "the port is open" check would call
the backend healthy while Postgres is down.
"""

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

_PROBE_KEY = "healthz:probe"


def _database_ok() -> bool:
    try:
        connection.ensure_connection()
    except Exception:
        return False
    return True


def _cache_ok() -> bool:
    try:
        cache.set(_PROBE_KEY, "ping", 5)
        return cache.get(_PROBE_KEY) == "ping"
    except Exception:
        return False


def healthz(_request):
    """GET /healthz/ — 200 when every dependency answers, 503 otherwise."""
    checks = {"database": _database_ok(), "cache": _cache_ok()}
    healthy = all(checks.values())
    body = {
        "status": "ok" if healthy else "fail",
        **{name: ("ok" if value else "fail") for name, value in checks.items()},
    }
    return JsonResponse(body, status=200 if healthy else 503)
