from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


class EmailNotVerified(PermissionDenied):
    """403 for an action that needs a verified address.

    The body carries a ``code`` next to the ``detail`` — DRF's own 403 has the
    detail only — so the frontend can tell this refusal from any other in one
    place and offer to send the verification email.
    """

    default_detail = "Confirm your email address first."
    default_code = "email_not_verified"

    def __init__(self):
        super().__init__({"code": self.default_code, "detail": self.default_detail})


class HasVerifiedEmail(BasePermission):
    """Lets through only a user whose address is verified.

    Signing in and looking around stay open to everyone; this guards what
    counts — submitting a solution and registering for a contest. Put it after
    IsAuthenticated, so an anonymous caller still gets 401, not this 403.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if not user.email_verified:
            raise EmailNotVerified()
        return True
