from django.test import RequestFactory

from core.middleware import RealClientIPMiddleware

PROXY_IP = "172.18.0.5"
VISITOR_IP = "203.0.113.7"


def call_middleware(**extra):
    """Run a request through the middleware and return it as the view sees it."""
    seen = {}

    def view(request):
        seen["request"] = request
        return "response"

    request = RequestFactory().get("/api/problems/", REMOTE_ADDR=PROXY_IP, **extra)
    RealClientIPMiddleware(view)(request)
    return seen["request"]


def test_visitor_address_replaces_the_proxy():
    request = call_middleware(HTTP_X_REAL_IP=VISITOR_IP)

    assert request.META["REMOTE_ADDR"] == VISITOR_IP


def test_address_untouched_without_the_header():
    """Direct hits (health checks inside the network) keep their own address."""
    request = call_middleware()

    assert request.META["REMOTE_ADDR"] == PROXY_IP
