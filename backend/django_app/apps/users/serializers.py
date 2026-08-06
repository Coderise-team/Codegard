from django.conf import settings
from django.contrib.auth.password_validation import (
    validate_password as dj_validate_password,
)
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import EloHistory, User
from .services import RANK_THRESHOLDS, get_rank

# Avatar upload validation constants. The image sizing/output constants live in
# apps/users/images.py, next to the cutter that owns them.
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Profile edit constants
MAX_BIO_LENGTH = 300


class UserRegisterSerializer(serializers.ModelSerializer):
    """Serializer used for user registration."""

    class Meta:
        model = User
        fields = ["username", "email", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_username(self, value):
        if value.lower() in settings.RESERVED_USERNAMES:
            raise serializers.ValidationError("This username is reserved")
        return value

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email already exists")
        return value

    def validate_password(self, value):
        dj_validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Public user representation with rank computed on the fly from elo_rating."""

    rank = serializers.SerializerMethodField()
    maxRating = serializers.IntegerField(source="max_rating", read_only=True)
    globalRank = serializers.SerializerMethodField()
    nextTier = serializers.SerializerMethodField()
    joined = serializers.DateTimeField(source="date_joined", read_only=True)
    # The API serves the thumbnail; the master copy stays server-side only.
    avatar = serializers.ImageField(source="avatar_thumb", read_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "first_name",
            "last_name",
            "elo_rating",
            "rank",
            "avatar",
            "bio",
            "maxRating",
            "globalRank",
            "nextTier",
            "joined",
        ]

    def get_rank(self, obj) -> str:
        return get_rank(obj.elo_rating)

    def get_globalRank(self, obj) -> int:
        return User.objects.filter(elo_rating__gt=obj.elo_rating).count() + 1

    def get_nextTier(self, obj):
        tiers = list(reversed(RANK_THRESHOLDS))
        current = 0
        for i, (floor, _name) in enumerate(tiers):
            if obj.elo_rating >= floor:
                current = i
        nxt = current + 1
        if nxt >= len(tiers):
            return None
        return {
            "name": tiers[nxt][1],
            "floor": tiers[current][0],
            "ceil": tiers[nxt][0],
        }


class EloHistorySerializer(serializers.ModelSerializer):
    """One ELO change entry for the rating-history endpoint (sparkline data)."""

    class Meta:
        model = EloHistory
        fields = ["rating", "created_at"]


class AvatarUploadSerializer(serializers.ModelSerializer):
    """Validates and saves an avatar image for the authenticated user."""

    class Meta:
        model = User
        fields = ("avatar",)

    def validate_avatar(self, value):
        """Validate only — resizing/cropping is done by apps.users.images.

        Image.verify() consumes the file object, so the file is rewound before
        it is returned for the view to hand to the cutter.
        """
        if value.size > MAX_AVATAR_SIZE_BYTES:
            raise serializers.ValidationError(
                f"Image too large. Maximum size is "
                f"{MAX_AVATAR_SIZE_BYTES // (1024 * 1024)} MB."
            )
        content_type = getattr(value, "content_type", None)
        if content_type and content_type not in ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(
                f"Unsupported image type '{content_type}'. "
                f"Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}."
            )
        try:
            value.seek(0)
            Image.open(value).verify()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise serializers.ValidationError("Invalid image file.") from exc
        value.seek(0)  # verify() burned the object — rewind for the cutter
        return value


class EmailOrUsernameTokenObtainSerializer(TokenObtainPairSerializer):
    """Allow JWT authentication using either username or email."""

    # One generic message for every failed login. Saying which half was wrong
    # would let an attacker probe which usernames/emails exist on the platform.
    default_error_messages = {
        "no_active_account": "Incorrect username/email or password.",
    }

    def validate(self, attrs):
        login = attrs.get("username", "")
        if "@" in login:
            try:
                user = User.objects.get(email__iexact=login)
                attrs["username"] = user.username
            except User.DoesNotExist:
                pass
        return super().validate(attrs)


class UserMeSerializer(serializers.ModelSerializer):
    """The authenticated user's own profile (read) — also feeds the settings form."""

    # The API serves the thumbnail; the master copy stays server-side only.
    avatar = serializers.ImageField(source="avatar_thumb", read_only=True)

    class Meta:
        model = User
        fields = ["username", "avatar", "bio", "first_name", "last_name"]


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """PATCH /api/users/me/ — the ONLY editable profile fields.

    A strict allow-list: username / email / elo_rating sent in the payload are
    silently ignored simply because they are not declared here. username stays
    fixed (public URLs & history depend on it); email stays fixed (an honest
    change needs email confirmation, which we don't have yet).
    """

    bio = serializers.CharField(
        max_length=MAX_BIO_LENGTH,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = ["bio", "first_name", "last_name"]


class PasswordChangeSerializer(serializers.Serializer):
    """POST /api/users/me/password/ — old_password + new_password."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user

        # 1. OAuth accounts (unusable password) can't change a password they
        # never had — they'll set one later via "forgot password".
        if not user.has_usable_password():
            raise serializers.ValidationError(
                {"old_password": "This account has no password set."}
            )

        # 2. Proving identity with the current password is required: an open
        # stolen tab must not be enough to take over the account.
        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError(
                {"old_password": "Current password is incorrect."}
            )

        # 3. Same Django validators as registration, but WITH the user so the
        # similarity-to-username/email validator can run.
        dj_validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class StandingsRowSerializer(serializers.ModelSerializer):
    """One row of the global ELO standings table.

    ``globalRank`` (dense rank) and ``delta`` (last rated-contest change) are
    injected as annotations by the view. The rank (Master/Expert/…) is not
    returned — the frontend derives it from the rating, same as ``registrants``.
    """

    maxRating = serializers.IntegerField(source="max_rating", read_only=True)
    globalRank = serializers.IntegerField(source="global_rank", read_only=True)
    delta = serializers.IntegerField(read_only=True, allow_null=True)
    # Denormalised thumbnail URL — no per-row query, so the leaderboard can
    # finally carry avatars. DRF builds the absolute URL and returns null itself.
    avatar = serializers.ImageField(source="avatar_thumb", read_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "avatar",
            "elo_rating",
            "maxRating",
            "globalRank",
            "delta",
        ]
