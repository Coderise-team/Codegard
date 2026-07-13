from rest_framework import serializers

from .models import Submission


class SubmissionCreateSerializer(serializers.ModelSerializer):
    """Used for POST /api/submissions/ — accepts code, language, problem, contest."""

    class Meta:
        model = Submission
        fields = ["id", "problem", "contest", "code", "language"]

    def validate(self, attrs):
        """Enforce the contest submission rules: when a contest is given, the
        problem must belong to it and the contest must currently be active
        (status is refreshed from the clock before the check)."""
        contest = attrs.get("contest")
        problem = attrs.get("problem")

        # If contest is provided — problem must belong to that contest
        if contest and not contest.problems.filter(pk=problem.pk).exists():
            raise serializers.ValidationError(
                {"problem": "This problem is not part of the specified contest."}
            )

        # Contest must be active to submit
        if contest:
            contest.update_status()
            from apps.contests.models import Contest

            if contest.status != Contest.Status.ACTIVE:
                raise serializers.ValidationError(
                    {"contest": "You can only submit during an active contest."}
                )

        return attrs

    def create(self, validated_data):
        # User is injected from the view
        return Submission.objects.create(**validated_data)


class SubmissionSerializer(serializers.ModelSerializer):
    """Used for GET — read-only, full info."""

    problem_title = serializers.CharField(source="problem.title", read_only=True)
    verdict_display = serializers.CharField(
        source="get_verdict_display", read_only=True
    )
    language_display = serializers.CharField(
        source="get_language_display", read_only=True
    )
    is_pending = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "user",
            "problem",
            "problem_title",
            "contest",
            "code",
            "language",
            "language_display",
            "verdict",
            "verdict_display",
            "is_pending",
            "execution_time_ms",
            "memory_used_mb",
            "stderr",
            "error_message",
            "created_at",
        ]
        read_only_fields = fields

    def get_is_pending(self, obj):
        return obj.verdict is None


class PublicSubmissionSerializer(serializers.ModelSerializer):
    """Read-only submission row for a public profile — no source code.

    Used by GET /api/users/{username}/submissions/. Deliberately omits
    `code`/`stderr`/`error_message`: never expose another user's source.
    """

    problem_title = serializers.CharField(source="problem.title", read_only=True)
    verdict_display = serializers.CharField(
        source="get_verdict_display", read_only=True
    )
    language_display = serializers.CharField(
        source="get_language_display", read_only=True
    )

    class Meta:
        model = Submission
        fields = [
            "id",
            "problem",
            "problem_title",
            "verdict",
            "verdict_display",
            "language_display",
            "execution_time_ms",
            "created_at",
        ]
        read_only_fields = fields
