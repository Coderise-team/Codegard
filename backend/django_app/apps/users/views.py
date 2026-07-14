from datetime import timedelta

from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.db.models import Count, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, TruncDate
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import (
    ListAPIView,
    RetrieveAPIView,
    RetrieveUpdateAPIView,
)
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView
from sorl.thumbnail import get_thumbnail

from . import oauth
from .models import EloHistory, User
from .oauth import OAuthError
from .pagination import StandingsPagination
from .serializers import (
    AvatarUploadSerializer,
    EloHistorySerializer,
    EmailOrUsernameTokenObtainSerializer,
    PasswordChangeSerializer,
    StandingsRowSerializer,
    UserMeSerializer,
    UserProfileUpdateSerializer,
    UserRegisterSerializer,
    UserSerializer,
)
from .services import RANK_THRESHOLDS

# Difficulty buckets, in the order the breakdown endpoint returns them.
DIFFICULTIES = ("easy", "medium", "hard")

# Number of days included in a user's submission activity timeline.
ACTIVITY_WINDOW_DAYS = 365

# Number of most-recent submissions returned for a public profile.
RECENT_SUBMISSIONS_LIMIT = 15


class RegisterView(APIView):
    """Register a new user and immediately issue JWT tokens."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.avatar = serializer.validated_data["avatar"]
        user.save(update_fields=["avatar"])
        thumb_128 = get_thumbnail(user.avatar, "128x128", crop="center", quality=85)
        thumb_256 = get_thumbnail(user.avatar, "256x256", crop="center", quality=85)

        return Response(
            {
                "avatar": user.avatar.url,
                "thumbnails": {
                    "128": thumb_128.url,
                    "256": thumb_256.url,
                },
            }
        )


class LogoutView(APIView):
    """Blacklist a refresh token and log out the authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data["refresh"])
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)

        except KeyError:
            return Response(
                {"error": "Refresh token required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except TokenError:
            return Response(
                {"error": "Invalid token"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class LoginView(TokenObtainPairView):
    """Issue JWT tokens using either username or email credentials."""

    serializer_class = EmailOrUsernameTokenObtainSerializer


class OAuthStartView(APIView):
    """Hand the SPA a provider authorize URL with a fresh one-time state."""

    permission_classes = [AllowAny]

    def get(self, request, provider: str):
        try:
            url = oauth.build_authorize_url(provider, oauth.issue_state(provider))
        except OAuthError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"authorize_url": url})


class OAuthCallbackView(APIView):
    """Provider redirect target: verify state, resolve the user and send
    the browser to the SPA with a one-time login ticket."""

    permission_classes = [AllowAny]

    def get(self, request, provider: str):
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not oauth.redeem_state(provider, state):
            return redirect("/login?oauth_error=state")
        try:
            token = oauth.exchange_code(provider, code)
            identity = oauth.fetch_identity(provider, token)
            user = oauth.find_or_create_user(provider, identity)
        except OAuthError as exc:
            return redirect(f"/login?oauth_error={exc}")
        return redirect(f"/oauth/callback?ticket={oauth.issue_login_ticket(user.id)}")


class OAuthRedeemView(APIView):
    """Exchange a one-time login ticket for the usual JWT pair."""

    permission_classes = [AllowAny]

    def post(self, request):
        user_id = oauth.redeem_login_ticket(request.data.get("ticket"))
        user = User.objects.filter(id=user_id).first() if user_id else None
        if user is None:
            return Response(
                {"error": "Invalid ticket"}, status=status.HTTP_400_BAD_REQUEST
            )
        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class UserActivityView(APIView):
    """Return per-day submission counts for the last 365 days."""

    permission_classes = [IsAuthenticated]

    def get(self, request, username: str):
        user = get_object_or_404(User, username=username)
        since = timezone.now() - timedelta(days=ACTIVITY_WINDOW_DAYS)
        rows = (
            Submission.objects.filter(user=user, created_at__gte=since)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        # Sparse: only days that actually have submissions are returned.
        data = {row["day"].isoformat(): row["count"] for row in rows}
        return Response(data)


class UserStatsView(APIView):
    """Aggregate stats for the dashboard StatsStrip: solved, contests, acceptance."""

    permission_classes = [IsAuthenticated]

    def get(self, request, username: str):
        user = get_object_or_404(User, username=username)
        submissions = Submission.objects.filter(user=user)
        total = submissions.count()

        solved = (
            Submission.objects.filter(user=user, verdict=Submission.Verdict.AC)
            .values("problem")
            .distinct()
            .count()
        )
        accepted = submissions.filter(verdict=Submission.Verdict.AC).count()

        contests = user.contests.count()

        acceptance = 0 if total == 0 else round(accepted / total * 100)

        return Response(
            {
                "solved": solved,
                "contests": contests,
                "acceptance": acceptance,
            }
        )


class UserDifficultyView(APIView):
    """Solved/total problem counts per difficulty.

    Feeds the ProfilePage 'Solved by difficulty' card and the ProblemsPage
    progress card.

    GET /api/users/{username}/difficulty/ ->
        {"easy": {"solved": int, "total": int}, "medium": {...}, "hard": {...}}
    Any authenticated user can view anyone's breakdown (like stats/streak).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, username: str):
        user = get_object_or_404(User, username=username)

        totals = {
            row["difficulty"]: row["n"]
            for row in Problem.objects.values("difficulty")
            .annotate(n=Count("id"))
            .order_by()
        }

        solved = {
            row["problem__difficulty"]: row["n"]
            for row in Submission.objects.filter(
                user=user, verdict=Submission.Verdict.AC
            )
            .values("problem__difficulty")
            .annotate(n=Count("problem", distinct=True))
            .order_by()
        }

        data = {
            d: {"solved": solved.get(d, 0), "total": totals.get(d, 0)}
            for d in DIFFICULTIES
        }
        return Response(data)


class UserEloHistoryView(APIView):
    """
    ELO rating change history for a user, for a Dashboard rating sparkline.

    GET /api/users/{username}/elo-history/ -> list of ELO changes oldest-first
    (chronological), so the frontend can plot the rating over time directly.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, username: str):
        user = get_object_or_404(User, username=username)
        history = EloHistory.objects.filter(user=user).order_by("created_at")
        return Response(EloHistorySerializer(history, many=True).data)


class UserStreakView(APIView):
    """Daily-challenge streak for a user, for the dashboard Daily challenge block.

    GET /api/users/{username}/streak/ -> {current_streak, longest_streak, history}.
    Any authenticated user can view anyone's streak (like stats/activity).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, username: str):
        from apps.problems.services import compute_streak

        user = get_object_or_404(User, username=username)
        return Response(compute_streak(user))


class UserContestHistoryView(APIView):
    """Finished-contest history for a user, for the ProfilePage PastContests block.

    GET /api/users/{username}/contest-history/ -> paginated, newest first.
    Response is the standard {count, next, previous, results} envelope; the page
    size defaults to 20 and can be set with ?page_size= (dashboard asks for 5).
    Any authenticated user can view anyone's history (like stats/streak).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, username: str):
        from apps.contests.serializers import ContestHistorySerializer
        from apps.contests.services import get_contest_history

        from .pagination import ContestHistoryPagination

        user = get_object_or_404(User, username=username)
        history = get_contest_history(user)

        # APIView has no built-in pagination, so drive the paginator by hand.
        paginator = ContestHistoryPagination()
        page = paginator.paginate_queryset(history, request, view=self)
        serializer = ContestHistorySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class UserSubmissionsView(APIView):
    """Latest submissions for a user, for the ProfilePage RecentSubmissions block.

    GET /api/users/{username}/submissions/ -> list, newest first, capped.
    Source code is intentionally omitted (see PublicSubmissionSerializer).
    Any authenticated user can view anyone's submissions (like stats/streak).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, username: str):
        from apps.submissions.serializers import PublicSubmissionSerializer

        user = get_object_or_404(User, username=username)
        submissions = (
            Submission.objects.filter(user=user)
            .select_related("problem")
            .order_by("-created_at")[:RECENT_SUBMISSIONS_LIMIT]
        )
        return Response(PublicSubmissionSerializer(submissions, many=True).data)


class UserDetailView(RetrieveAPIView):
    """GET /api/users/{username}/ — public profile incl. rank from elo_rating."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "username"
    lookup_url_kwarg = "username"


class MeView(RetrieveUpdateAPIView):
    """Read (GET) or partially update (PATCH) the authenticated user's profile.

    PUT is intentionally disabled — only partial updates of the three editable
    fields (bio / first_name / last_name) are allowed; read and write use
    different serializers.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return UserProfileUpdateSerializer
        return UserMeSerializer


class PasswordChangeView(APIView):
    """POST /api/users/me/password/ — change the authenticated user's password.

    On success every existing refresh token is revoked (a stolen-password
    session is kicked out) and a fresh {access, refresh} pair is issued so the
    caller stays logged in without re-authenticating.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Revoke all outstanding refresh tokens FIRST, then mint the new pair —
        # otherwise the fresh refresh would be blacklisted too. get_or_create
        # guards against tokens that are already blacklisted.
        for token in OutstandingToken.objects.filter(user=request.user):
            BlacklistedToken.objects.get_or_create(token=token)

        refresh = RefreshToken.for_user(request.user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class StandingsView(ListAPIView):
    """GET /api/users/standings/ — the global ELO leaderboard.

    Each row carries a DENSE global rank computed via a correlated subquery, so
    the number stays global under any tier filter, sort direction, or page (a
    window function would recompute inside the filtered set — a silent bug). The
    rank is computed against whichever field is being sorted (elo_rating or
    max_rating). The envelope adds ``total`` (all active users, ignoring the
    tier filter) and ``you`` (the caller's own row, always present).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = StandingsRowSerializer
    pagination_class = StandingsPagination

    _ORDERING = {"-elo_rating", "elo_rating", "-max_rating", "max_rating"}

    def _ordering(self):
        # Parsed by hand (not OrderingFilter): the sort field must be known
        # before building the queryset, because the rank subquery ranks by it.
        # Garbage falls back to the default.
        ordering = self.request.query_params.get("ordering", "-elo_rating")
        return ordering if ordering in self._ORDERING else "-elo_rating"

    def _annotated(self):
        """All active users, annotated with the dense global rank (by the active
        sort field) and the last rated-contest delta. Not tier-filtered — the
        rank must stay global, and ``you`` reuses this same annotation."""
        from apps.contests.models import ContestScore

        ordering = self._ordering()
        field = ordering.lstrip("-")

        # Dense rank = count of DISTINCT greater values of `field`, + 1.
        higher_distinct = (
            User.objects.filter(is_active=True, **{f"{field}__gt": OuterRef(field)})
            .order_by()
            .annotate(_g=Value(1))
            .values("_g")
            .annotate(n=Count(field, distinct=True))
            .values("n")
        )
        # Last rated contest's delta (skip live contests where it's still NULL).
        delta_sq = (
            ContestScore.objects.filter(user=OuterRef("pk"), rating_delta__isnull=False)
            .order_by("-contest__end_time", "-contest_id")
            .values("rating_delta")[:1]
        )
        return (
            User.objects.filter(is_active=True)
            .annotate(
                global_rank=Coalesce(
                    Subquery(higher_distinct, output_field=IntegerField()), Value(0)
                )
                + Value(1),
                delta=Subquery(delta_sq, output_field=IntegerField()),
            )
            .order_by(ordering, "id")
        )

    def _tier_bounds(self, tier):
        """Map a rank name to its [floor, ceil) rating range, or None if unknown
        (unknown tier is ignored, not a 400). The top tier has no ceiling."""
        floors = {name: floor for floor, name in RANK_THRESHOLDS}
        if tier not in floors:
            return None
        floor = floors[tier]
        higher = [t for t, _ in RANK_THRESHOLDS if t > floor]
        return floor, (min(higher) if higher else None)

    def get_queryset(self):
        qs = self._annotated()
        # Tier filter cuts ROWS by current elo_rating; the rank stays global
        # because it's a subquery the outer WHERE can't see.
        bounds = self._tier_bounds(self.request.query_params.get("tier", ""))
        if bounds:
            floor, ceil = bounds
            qs = qs.filter(elo_rating__gte=floor)
            if ceil is not None:
                qs = qs.filter(elo_rating__lt=ceil)
        return qs

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        # total ignores the tier filter (header "all coders"); you ignores it too.
        self.paginator.total = User.objects.filter(is_active=True).count()
        me = self._annotated().filter(pk=request.user.pk).first()
        self.paginator.you = self.get_serializer(me).data if me is not None else None
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)
