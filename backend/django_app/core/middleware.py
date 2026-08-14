class RealClientIPMiddleware:
    """Put the visitor's address into REMOTE_ADDR, taken from X-Real-IP.

    Behind nginx every request arrives from the proxy, so REMOTE_ADDR is the
    proxy and anything keyed on the client address (rate limits, bans, audit
    trails) would see the whole world as one caller.

    Trusting the header is safe only because gunicorn publishes no port: nginx
    is the single way in, and it overwrites X-Real-IP on every request. Never
    enable this on a service reachable directly.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        real_ip = request.META.get("HTTP_X_REAL_IP")
        if real_ip:
            request.META["REMOTE_ADDR"] = real_ip
        return self.get_response(request)
