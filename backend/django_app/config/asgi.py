"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.conf import settings
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings.prod")

django.setup()

django_asgi_app = get_asgi_application()

from apps.realtime.middleware import TicketAuthMiddleware  # noqa: E402
from apps.realtime.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # Authenticate WS via one-time ?ticket= (see apps.realtime.middleware).
        # Replaces the session-cookie AuthMiddlewareStack: the frontend is
        # JWT-based and browsers can't send auth headers on a WebSocket.
        "websocket": AllowedHostsOriginValidator(
            TicketAuthMiddleware(URLRouter(websocket_urlpatterns))
        ),
    }
)

if settings.DEBUG:
    from django.contrib.staticfiles.handlers import ASGIStaticFilesHandler

    application = ASGIStaticFilesHandler(application)
