from collections import defaultdict

from apps.problems.models import Problem
from apps.submissions.models import Submission
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import (
    IsAdminUser,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from .models import Contest, ContestScore
from .pagination import ContestListPagination, ContestPanelPagination
from .serializers import (
    ContestDetailSerializer,
    ContestRegistrantSerializer,
    ContestSerializer,
    ContestWriteSerializer,
    LeaderboardEntrySerializer,
)
from .services import get_leaderboard


def _leaderboard_rank(contest, user_id):
    """1-based position of user_id in the contest leaderboard, or None."""
    user_ids = list(get_leaderboard(contest).values_list("user_id", flat=True))
    try:
        return user_ids.index(user_id) + 1
    except ValueError:
        return None


class ContestViewSet(viewsets.ModelViewSet):
    """
    CRUD for Contests + join action.

    GET    /api/contests/              — list all contests
    POST   /api/contests/              — create contest (admin only)
    GET    /api/contests/{id}/         — retrieve contest with problems
    PUT    /api/contests/{id}/         — update contest (admin only)
    PATCH  /api/contests/{id}/         — partial update (admin only)
    DELETE /api/contests/{id}/         — delete contest (admin only)
    POST   /api/contests/{id}/join/    — join contest (authenticated users)
    POST   /api/contests/{id}/leave/   — leave contest (authenticated users)
    """

    queryset = Contest.objects.prefetch_related("problems").all()
    pagination_class = ContestListPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title"]
    ordering_fields = ["start_time"]
    ordering = ["-start_time"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminUser()]
        if self.action in ["join", "leave", "my_standing"]:
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ContestWriteSerializer
        if self.action == "retrieve":
            return ContestDetailSerializer
        return ContestSerializer

    def get_queryset(self):
        from django.db.models import Count, Exists, OuterRef, Prefetch, Q

        queryset = super().get_queryset()

        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter in ["pending", "active", "finished"]:
            queryset = queryset.filter(status=status_filter)

        # Annotations to avoid N+1 queries
        queryset = queryset.annotate(
            participants_count_annotated=Count("participants", distinct=True),
            problems_count_annotated=Count("problems", distinct=True),
        )

        user = self.request.user
        if user and user.is_authenticated:
            # Check if user is in the M2M through table
            ThroughModel = Contest.participants.through
            user_joined = ThroughModel.objects.filter(
                contest_id=OuterRef("pk"), user_id=user.pk
            )
            queryset = queryset.annotate(is_joined_annotated=Exists(user_joined))

        # "My contests" filter for the dashboard. Reuses the is_joined annotation
        # (only present for authenticated users). Any value other than "true" is
        # ignored, same pattern as `status`; an anonymous user gets nothing.
        if self.request.query_params.get("joined") == "true":
            if user and user.is_authenticated:
                queryset = queryset.filter(is_joined_annotated=True)
            else:
                queryset = queryset.none()

        # Retrieve only: attach `solved_count` (unique solvers of each problem IN
        # THIS contest) via an annotated prefetch — one JOIN, no N+1, and the
        # hub list never pays for it. The contest pk is known from the URL.
        if self.action == "retrieve":
            solved_count = Count(
                "submissions__user",
                filter=Q(
                    submissions__contest_id=self.kwargs.get("pk"),
                    submissions__verdict=Submission.Verdict.AC,
                ),
                distinct=True,
            )
            # Replace the base `prefetch_related("problems")` rather than adding a
            # second lookup for the same relation (Django rejects that).
            queryset = queryset.prefetch_related(None).prefetch_related(
                Prefetch(
                    "problems",
                    queryset=Problem.objects.annotate(solved_count=solved_count),
                )
            )

        # Ordering is left to OrderingFilter (default -start_time above).
        return queryset

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def join(self, request, pk=None):
        """POST /api/contests/{id}/join/"""
        contest = self.get_object()
        contest.update_status()

        if contest.status == Contest.Status.FINISHED:
            return Response(
                {"detail": "Cannot join a finished contest."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if contest.participants.filter(pk=request.user.pk).exists():
            return Response(
                {"detail": "You have already joined this contest."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contest.participants.add(request.user)
        return Response(
            {"detail": "Successfully joined the contest."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def leave(self, request, pk=None):
        """POST /api/contests/{id}/leave/"""
        contest = self.get_object()

        if contest.status == Contest.Status.ACTIVE:
            return Response(
                {"detail": "Cannot leave an active contest."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not contest.participants.filter(pk=request.user.pk).exists():
            return Response(
                {"detail": "You are not a participant of this contest."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contest.participants.remove(request.user)
        return Response(
            {"detail": "Successfully left the contest."},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def registrants(self, request, pk=None):
        """GET /api/contests/{id}/registrants/ — paginated, rating desc.

        Powers the "Registered" panel before a contest starts. Sorted by
        `-elo_rating`, then `id` as a tiebreak — without it, rows with the same
        (very common) default rating reshuffle between pages.
        """
        contest = self.get_object()
        participants = contest.participants.order_by("-elo_rating", "id").only(
            "id", "username", "elo_rating"
        )
        paginator = ContestPanelPagination()
        page = paginator.paginate_queryset(participants, request, view=self)
        serializer = ContestRegistrantSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def leaderboard(self, request, pk=None):
        """GET /api/contests/{id}/leaderboard/"""
        contest = self.get_object()
        entries = get_leaderboard(contest)

        # Inject rank number
        data = []
        for rank, entry in enumerate(entries, start=1):
            entry.rank = rank
            data.append(entry)

        serializer = LeaderboardEntrySerializer(data, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["get"],
        url_path="my-standing",
        permission_classes=[IsAuthenticated],
    )
    def my_standing(self, request, pk=None):
        """GET /api/contests/{id}/my-standing/ — my rank/score/solved + statuses."""
        contest = self.get_object()

        score_obj = ContestScore.objects.filter(
            user=request.user, contest=contest
        ).first()
        score = score_obj.score if score_obj else 0
        solved = score_obj.solved_count if score_obj else 0
        rank = _leaderboard_rank(contest, request.user.pk) if score_obj else None

        # All my submissions for this contest in ONE query, grouped in memory.
        verdicts_by_problem = defaultdict(set)
        for problem_id, verdict in Submission.objects.filter(
            user=request.user, contest=contest
        ).values_list("problem_id", "verdict"):
            verdicts_by_problem[problem_id].add(verdict)

        problems = []
        for problem in contest.problems.all():
            verdicts = verdicts_by_problem.get(problem.id)
            if verdicts is None:
                problem_status = "open"
            elif Submission.Verdict.AC in verdicts:
                problem_status = "solved"
            else:
                problem_status = "attempted"
            problems.append({"id": problem.id, "status": problem_status})

        return Response(
            {"rank": rank, "score": score, "solved": solved, "problems": problems}
        )
