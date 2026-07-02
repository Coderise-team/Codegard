from rest_framework import mixins, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Submission
from .serializers import SubmissionCreateSerializer, SubmissionSerializer
from .tasks import push_to_judge_queue

LANGUAGE_TEMPLATES = {
    Submission.Language.PYTHON: {
        "name": Submission.Language.PYTHON.label,
        "template": "import sys\n\ndata = sys.stdin.read().split()\n"
        "# your code here \n",
    },
}


class SubmissionViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    Submissions — create and read only (no update, no delete).

    POST   /api/submissions/        — create submission, send to judge queue
    GET    /api/submissions/        — list own submissions
    GET    /api/submissions/{id}/   — retrieve own submission
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Submission.objects.select_related("problem", "contest")
            .filter(user=self.request.user)
            .order_by("-created_at")
        )
        problem = self.request.query_params.get("problem")
        if problem and problem.isdigit():
            qs = qs.filter(problem_id=problem)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return SubmissionCreateSerializer
        return SubmissionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Inject current user
        submission = serializer.save(user=request.user)

        # Push to Redis judge queue
        queued = push_to_judge_queue(submission)

        return Response(
            {
                "id": submission.pk,
                "status": "queued" if queued else "queue_error",
                "verdict": submission.verdict,  # None at this point
                "created_at": submission.created_at,
            },
            status=status.HTTP_201_CREATED,
        )


class LanguagesView(APIView):
    """GET /api/languages/ - supported languages + editor starter templates.

    Public config (the editor needs it); not user-specific.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        templates = [
            {
                "id": lang.value,
                "name": data["name"],
                "template": data["template"],
            }
            for lang, data in LANGUAGE_TEMPLATES.items()
        ]

        return Response(templates)
