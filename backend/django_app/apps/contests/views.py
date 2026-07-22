from collections import defaultdict

from apps.problems.models import Problem
from apps.submissions.models import Submission
from django.core.cache import cache
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import (
    IsAdminUser,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from .cache import LEADERBOARD_TTL, leaderboard_page_key
from .models import Contest, ContestScore
from .pagination import ContestListPagination, ContestPanelPagination
from .serializers import (
    ContestDetailSerializer,
    ContestRegistrantSerializer,
    ContestSerializer,
    ContestWriteSerializer,
    LeaderboardEntrySerializer,
)
from .services import get_leaderboard, get_participant_rank


def _leaderboard_rank(contest, user_id):
    """Dense rank of user_id in the contest leaderboard, or None.

    Delegates to the DB (see ``get_participant_rank``) — it used to load every
    participant id into memory and index the list, which got expensive now that
    the frontend polls my-standing alongside the leaderboard.
    """
    return get_participant_rank(contest, user_id)


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

        # Leaving is only allowed before the start. Once the contest has begun
        # the participant owns a row in the standings, and removing them would
        # rewrite history — including after the contest is over and rated.
        # Checked against start_time, not `status`: the status column is a
        # cached value refreshed by a beat and can lag by a minute.
        if contest.start_time <= timezone.now():
            return Response(
                {"detail": "Cannot leave a contest that has already started."},
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
        """GET /api/contests/{id}/leaderboard/ — standings, 10 rows per page."""
        contest = self.get_object()

        # The whole envelope is cached, not the queryset: this response is
        # identical for every viewer, and the window function behind it is the
        # most expensive query on the contest page.
        key = leaderboard_page_key(
            contest.pk,
            page=request.query_params.get("page", "1"),
            page_size=request.query_params.get("page_size", ""),
        )
        cached = cache.get(key)
        if cached is not None:
            return Response(cached)

        paginator = ContestPanelPagination()
        # rank comes from the queryset's dense-rank window — never positional,
        # so tied rows share a place and the number stays global across pages.
        page = paginator.paginate_queryset(get_leaderboard(contest), request, view=self)

        serializer = LeaderboardEntrySerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        cache.set(key, response.data, LEADERBOARD_TTL)
        return response

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
