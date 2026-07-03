from apps.submissions.models import Submission
from django.db.models import (
    Case,
    Count,
    Exists,
    F,
    FloatField,
    OuterRef,
    ProtectedError,
    Q,
    Value,
    When,
)
from django.http import JsonResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import (
    IsAdminUser,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from .filters import ProblemFilter
from .models import DailyProblem, Problem, Tag
from .serializers import (
    DailyProblemSerializer,
    ProblemSerializer,
    ProblemWriteSerializer,
    RecommendedProblemSerializer,
    TagSerializer,
)

RECOMMENDED_PER_DIFFICULTY = 2
RECOMMENDED_TOTAL = 6


class ProblemViewSet(viewsets.ModelViewSet):
    """
    CRUD for Problems.

    GET    /api/problems/          — list all problems (filter by ?difficulty=easy)
    POST   /api/problems/          — create problem (admin only)
    GET    /api/problems/{id}/     — retrieve problem with test cases
    PUT    /api/problems/{id}/     — update problem (admin only)
    PATCH  /api/problems/{id}/     — partial update (admin only)
    DELETE /api/problems/{id}/     — delete problem (admin only)
    """

    queryset = Problem.objects.prefetch_related("test_cases", "tags").all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = ProblemFilter
    search_fields = ["title"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminUser()]
        # NOTE: @action decorator permissions are ignored in this viewset (DRF
        # reads them from get_permissions), so the auth gates live here.
        if self.action in ["daily", "recommended"]:
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ProblemWriteSerializer
        return ProblemSerializer

    def get_queryset(self):
        # Filtering/ordering by ?difficulty/?tag/?status/?ordering is declarative
        # now (ProblemFilter). Here we only annotate the fields those rely on.
        queryset = super().get_queryset()

        # Acceptance counters in one pass - both counts over the same 'submissions'
        # relation, so it's a single JOIN with no fan-out (no distinct needed).
        queryset = queryset.annotate(
            total_submissions=Count("submissions"),
            ac_submissions=Count(
                "submissions",
                filter=Q(submissions__verdict=Submission.Verdict.AC),
            ),
            # Numeric rank so ?ordering=difficulty is easy→medium→hard, not
            # alphabetical (easy, hard, medium).
            difficulty_rank=Case(
                When(difficulty=Problem.Difficulty.EASY, then=Value(0)),
                When(difficulty=Problem.Difficulty.MEDIUM, then=Value(1)),
                When(difficulty=Problem.Difficulty.HARD, then=Value(2)),
                default=Value(0),
            ),
            user_status=self._user_status_annotation(),
        )
        # acceptance_rate for ?ordering=acceptance (divide-by-zero → 0), built
        # from the counters above. The serializer still computes the shown %.
        queryset = queryset.annotate(
            acceptance_rate=Case(
                When(total_submissions=0, then=Value(0.0)),
                default=1.0 * F("ac_submissions") / F("total_submissions"),
                output_field=FloatField(),
            )
        )
        # Default order (newest first); ?ordering overrides this via OrderingFilter.
        return queryset.order_by("-created_at")

    def _user_status_annotation(self):
        """solved / attempted / todo for request.user, in one query (no N+1).

        Anonymous users have no personal data → everything is "todo" (we never
        hit the DB with an anonymous user).
        """
        user = self.request.user
        if not user.is_authenticated:
            return Value("todo")

        my_subs = Submission.objects.filter(user=user, problem=OuterRef("pk"))
        my_ac = my_subs.filter(verdict=Submission.Verdict.AC)
        return Case(
            When(Exists(my_ac), then=Value("solved")),
            When(Exists(my_subs), then=Value("attempted")),
            default=Value("todo"),
        )

    def destroy(self, request, *args, **kwargs):
        # PROTECT on DailyProblem.problem raises ProtectedError for problems that
        # were ever a daily challenge — turn the expected 500 into a clean 409.
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete a problem that was a daily challenge."},
                status=status.HTTP_409_CONFLICT,
            )

    @action(detail=False, methods=["get"])
    def daily(self, request):
        """GET /api/problems/daily/ — today's shared daily challenge, or null."""
        today = timezone.now().date()
        problem_id = (
            DailyProblem.objects.filter(date=today)
            .values_list("problem_id", flat=True)
            .first()
        )
        if problem_id is None:
            # DRF's Response(None) renders an empty body; the contract needs a
            # literal JSON `null`, so use JsonResponse here.
            return JsonResponse(None, safe=False)

        problem = (
            Problem.objects.filter(pk=problem_id)
            .prefetch_related("tags")
            .annotate(
                total_submissions=Count("submissions"),
                ac_submissions=Count(
                    "submissions",
                    filter=Q(submissions__verdict=Submission.Verdict.AC),
                ),
            )
            .first()
        )
        solved_today = Submission.objects.filter(
            user=request.user,
            problem_id=problem_id,
            verdict=Submission.Verdict.AC,
            created_at__date=today,
        ).exists()

        serializer = DailyProblemSerializer(
            problem,
            context={"solved_today": solved_today, "request": request},
        )
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def recommended(self, request):
        """Up to 6 unsolved problems for the current user: 2 random per
        difficulty, backfilled across difficulties, ordered easy -> hard.
        Unsolved = the user has no AC for the problem.
        """
        user = request.user

        solved_ids = (
            Submission.objects.filter(user=user, verdict=Submission.Verdict.AC)
            .values_list("problem", flat=True)
            .distinct()
        )

        unsolved = (
            Problem.objects.exclude(id__in=solved_ids)
            .prefetch_related("tags")
            .annotate(
                total_submissions=Count("submissions"),
                ac_submissions=Count(
                    "submissions",
                    filter=Q(submissions__verdict=Submission.Verdict.AC),
                ),
            )
        )

        picked = []
        picked_ids = set()
        for difficulty in ("easy", "medium", "hard"):
            chunk = list(
                unsolved.filter(difficulty=difficulty).order_by("?")[
                    :RECOMMENDED_PER_DIFFICULTY
                ]
            )
            picked.extend(chunk)
            picked_ids.update(p.id for p in chunk)

        shortfall = RECOMMENDED_TOTAL - len(picked)
        if shortfall > 0:
            picked.extend(unsolved.exclude(id__in=picked_ids).order_by("?")[:shortfall])

        difficulty_rank = {"easy": 0, "medium": 1, "hard": 2}
        picked.sort(key=lambda p: difficulty_rank[p.difficulty])
        serializer = RecommendedProblemSerializer(picked, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def tags(self, request):
        """GET /api/problems/tags/ — all tags with their problem counts.

        Feeds the ProblemsPage filter dropdown. Public read (like the list).
        """
        qs = Tag.objects.annotate(count=Count("problems"))
        return Response(TagSerializer(qs, many=True).data)
