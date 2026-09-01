"""Scoped throttle that reads its rates on every request.

DRF's own ScopedRateThrottle copies DEFAULT_THROTTLE_RATES into a class
attribute at import time, so a test that swaps the rates in never reaches it.
"""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from rest_framework.throttling import ScopedRateThrottle


class DynamicScopedRateThrottle(ScopedRateThrottle):
    def get_rate(self):
        if not self.scope:
            return None

        rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        if self.scope not in rates:
            # A typo in throttle_scope would otherwise leave the view wide open.
            raise ImproperlyConfigured(f"No throttle rate set for '{self.scope}'")
        # An explicit None is how the test settings switch a limit off.
        return rates[self.scope]
