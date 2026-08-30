from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle

"""Scoped throttle that reads its rates on every request.

DRF's own ScopedRateThrottle copies DEFAULT_THROTTLE_RATES into a class attribute 
at import time, so tests that swap the rates in never reach it.
"""


class DynamicScopedRateThrottle(ScopedRateThrottle):
    def get_rate(self):
        if not self.scope:
            return None

        rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        return rates.get(self.scope)
