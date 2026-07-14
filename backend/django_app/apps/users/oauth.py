"""OAuth 2.0 login flow for Google and GitHub.

``start`` builds the provider authorize URL with a one-time ``state``; the
callback verifies it, exchanges the code and resolves a local user; the SPA
then redeems a short-lived one-time login ticket for a SimpleJWT pair.
"""

import re
import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core.cache import cache

from .models import OAuthAccount, User

STATE_TTL_SECONDS = 300
LOGIN_TICKET_TTL_SECONDS = 30
HTTP_TIMEOUT_SECONDS = 10

_STATE_PREFIX = "oauth:state:"
_TICKET_PREFIX = "oauth:ticket:"

_ENDPOINTS = {
    "google": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "userinfo": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "authorize": "https://github.com/login/oauth/authorize",
        "token": "https://github.com/login/oauth/access_token",
        "userinfo": "https://api.github.com/user",
        "emails": "https://api.github.com/user/emails",
        "scope": "read:user user:email",
    },
}


class OAuthError(Exception):
    """Provider round-trip failed or gave unusable data. str() is a short slug."""


def provider_config(provider: str) -> dict:
    cfg = settings.OAUTH_PROVIDERS.get(provider)
    if not cfg or not cfg["client_id"] or not cfg["client_secret"]:
        raise OAuthError("provider_not_configured")
    return cfg


def issue_state(provider: str) -> str:
    """Mint a one-time CSRF state for the authorize redirect."""
    state = secrets.token_urlsafe(32)
    cache.set(f"{_STATE_PREFIX}{provider}:{state}", True, STATE_TTL_SECONDS)
    return state


def redeem_state(provider: str, state: str | None) -> bool:
    """True once per issued state; unknown/expired/reused states fail."""
    if not state:
        return False
    key = f"{_STATE_PREFIX}{provider}:{state}"
    if cache.get(key) is None:
        return False
    cache.delete(key)
    return True


def issue_login_ticket(user_id: int) -> str:
    """Mint a one-time ticket the SPA exchanges for a JWT pair."""
    ticket = secrets.token_urlsafe(32)
    cache.set(f"{_TICKET_PREFIX}{ticket}", user_id, LOGIN_TICKET_TTL_SECONDS)
    return ticket


def redeem_login_ticket(ticket: str | None) -> int | None:
    if not ticket:
        return None
    key = f"{_TICKET_PREFIX}{ticket}"
    user_id = cache.get(key)
    if user_id is None:
        return None
    cache.delete(key)  # single-use
    return user_id


def _redirect_uri(provider: str) -> str:
    return f"{settings.OAUTH_REDIRECT_BASE}/api/users/oauth/{provider}/callback/"


def build_authorize_url(provider: str, state: str) -> str:
    cfg = provider_config(provider)
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": _redirect_uri(provider),
        "scope": _ENDPOINTS[provider]["scope"],
        "state": state,
    }
    if provider == "google":
        # Google requires response_type explicitly; GitHub has no such param.
        params["response_type"] = "code"
    return f"{_ENDPOINTS[provider]['authorize']}?{urlencode(params)}"


def exchange_code(provider: str, code: str) -> str:
    cfg = provider_config(provider)
    resp = requests.post(
        _ENDPOINTS[provider]["token"],
        data={
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "code": code,
            "redirect_uri": _redirect_uri(provider),
            "grant_type": "authorization_code",
        },
        # Without this GitHub answers with a urlencoded body, not JSON.
        headers={"Accept": "application/json"},
        timeout=HTTP_TIMEOUT_SECONDS,
    )
    payload = resp.json() if resp.status_code == 200 else {}
    if "access_token" not in payload:
        raise OAuthError("token_exchange_failed")
    return payload["access_token"]


def fetch_identity(provider: str, token: str) -> dict:
    """Return {"uid", "email", "email_verified", "username_hint"}."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(
        _ENDPOINTS[provider]["userinfo"], headers=headers, timeout=HTTP_TIMEOUT_SECONDS
    )
    if resp.status_code != 200:
        raise OAuthError("userinfo_failed")
    info = resp.json()

    if provider == "google":
        email = (info.get("email") or "").lower()
        return {
            "uid": str(info["sub"]),
            "email": email,
            "email_verified": bool(info.get("email_verified")),
            "username_hint": email.split("@")[0] if email else "user",
        }

    # GitHub may hide the email on the profile; the emails endpoint has it.
    email, verified = _github_verified_email(headers)
    return {
        "uid": str(info["id"]),
        "email": email,
        "email_verified": verified,
        "username_hint": info.get("login") or "user",
    }


def _github_verified_email(headers: dict) -> tuple[str, bool]:
    resp = requests.get(
        _ENDPOINTS["github"]["emails"], headers=headers, timeout=HTTP_TIMEOUT_SECONDS
    )
    if resp.status_code != 200:
        return "", False
    emails = resp.json()
    primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
    fallback = next((e for e in emails if e.get("verified")), None)
    chosen = primary or fallback
    if not chosen:
        return "", False
    return chosen["email"].lower(), True


def find_or_create_user(provider: str, identity: dict) -> User:
    """Resolve a provider identity to a local user.

    A known (provider, uid) pair wins outright; otherwise the identity is
    linked by email, and only a provider-verified one — an unverified
    address can be claimed by anyone at the provider.
    """
    try:
        return OAuthAccount.objects.get(
            provider=provider, provider_uid=identity["uid"]
        ).user
    except OAuthAccount.DoesNotExist:
        pass

    if not identity["email"] or not identity["email_verified"]:
        raise OAuthError("email_not_verified")

    user = User.objects.filter(email__iexact=identity["email"]).first()
    if user is None:
        # create_user without a password sets an unusable one.
        user = User.objects.create_user(
            username=_unique_username(identity["username_hint"]),
            email=identity["email"],
        )
    OAuthAccount.objects.create(
        user=user, provider=provider, provider_uid=identity["uid"]
    )
    return user


def _unique_username(hint: str) -> str:
    """Derive a free username from the provider hint."""
    base = re.sub(r"[^a-z0-9_-]", "", hint.lower()) or "user"
    candidate = base
    counter = 2

    while (
        candidate in settings.RESERVED_USERNAMES
        or User.objects.filter(username__iexact=candidate).exists()
    ):
        candidate = f"{base}{counter}"
        counter += 1

    return candidate
