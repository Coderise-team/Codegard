from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle


class DynamicScopedRateThrottle(ScopedRateThrottle):
    def get_rate(self):
        if not self.scope:
            return None

        rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        return rates.get(self.scope)
