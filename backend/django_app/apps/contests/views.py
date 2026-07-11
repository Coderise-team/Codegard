from collections import defaultdict

from apps.submissions.models import Submission
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import (
    IsAdminUser,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Contest, ContestScore
from .serializers import (
    ContestDetailSerializer,
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


class ContestLeaderboardPagination(PageNumberPagination):
    page_size = 10


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
        from django.db.models import Count, Exists, OuterRef

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
    def leaderboard(self, request, pk=None):
        """GET /api/contests/{id}/leaderboard/ — standings, 10 rows per page."""
        contest = self.get_object()

        paginator = ContestLeaderboardPagination()
        page = paginator.paginate_queryset(
            get_leaderboard(contest), request, view=self
        )

        start = paginator.page.start_index()
        for offset, entry in enumerate(page):
            entry.rank = start + offset

        serializer = LeaderboardEntrySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

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
