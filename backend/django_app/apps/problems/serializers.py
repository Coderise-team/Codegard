from rest_framework import serializers

from .models import Problem, ProblemReport, Tag, TestCase

MIN_REPORT_MESSAGE_LENGTH = 10
# The field is an unbounded TextField, so without a ceiling one request can put
# megabytes into the triage queue. Room for a long, detailed complaint.
MAX_REPORT_MESSAGE_LENGTH = 5000


def acceptance_from_annotations(obj) -> float:
    """Global AC rate (%) from `total_submissions`/`ac_submissions` annotations.

    Shared by ProblemSerializer and DailyProblemSerializer so the formula lives
    in one place. The view must annotate both counts; missing/None reads as 0.
    """
    total = getattr(obj, "total_submissions", 0) or 0
    if total == 0:
        return 0.0
    ac = getattr(obj, "ac_submissions", 0) or 0
    return round(ac / total * 100, 1)


class TagSerializer(serializers.ModelSerializer):
    """Tag with how many problems use it, for the catalog filter dropdown.

    `count` comes from the `count=Count("problems")` annotation the view adds.
    """

    count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ["name", "count"]


class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = ["id", "input", "expected_output", "note", "is_hidden"]


class TestCasePublicSerializer(serializers.ModelSerializer):
    """Serializer for regular users — hides is_hidden test cases."""

    class Meta:
        model = TestCase
        fields = ["id", "input", "expected_output", "note"]


class ProblemSerializer(serializers.ModelSerializer):
    """List / retrieve serializer — shows only visible test cases to regular users."""

    test_cases = serializers.SerializerMethodField()
    tags = serializers.SlugRelatedField(many=True, slug_field="name", read_only=True)
    acceptance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = [
            "id",
            "title",
            "description",
            "input_format",
            "output_format",
            "constraints",
            "difficulty",
            "time_limit",
            "memory_limit",
            "tags",
            "acceptance",
            "status",
            "test_cases",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_status(self, obj) -> str:
        # Injected by the view's user_status annotation; "todo" if absent.
        return getattr(obj, "user_status", "todo")

    def get_test_cases(self, obj):
        request = self.context.get("request")
        is_staff = request and request.user and request.user.is_staff

        if is_staff:
            # Staff sees all test cases including hidden
            qs = obj.test_cases.all()
            return TestCaseSerializer(qs, many=True).data
        else:
            # Regular users only see visible test cases
            qs = obj.test_cases.filter(is_hidden=False)
            return TestCasePublicSerializer(qs, many=True).data

    def get_acceptance(self, obj) -> float:
        return acceptance_from_annotations(obj)


class DailyProblemSerializer(serializers.ModelSerializer):
    """Thin serializer for the daily challenge card — no description/test cases."""

    tags = serializers.SlugRelatedField(many=True, slug_field="name", read_only=True)
    acceptance = serializers.SerializerMethodField()
    solved_today = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = ["id", "title", "difficulty", "tags", "acceptance", "solved_today"]

    def get_acceptance(self, obj) -> float:
        return acceptance_from_annotations(obj)

    def get_solved_today(self, obj) -> bool:
        # The view computes this with a single exists() and passes it in.
        return self.context["solved_today"]


class ProblemWriteSerializer(serializers.ModelSerializer):
    """Create / update serializer — accepts test_cases as nested input."""

    test_cases = TestCaseSerializer(many=True, required=False)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        min_length=1,
        write_only=True,
    )
    input_format = serializers.CharField()
    output_format = serializers.CharField()
    constraints = serializers.CharField()

    class Meta:
        model = Problem
        fields = [
            "id",
            "title",
            "description",
            "input_format",
            "output_format",
            "constraints",
            "difficulty",
            "time_limit",
            "memory_limit",
            "is_hidden",
            "test_cases",
            "tags",
        ]

    def _set_tags(self, problem, tag_names):
        """Resolve tag names to Tag rows (creating missing ones) and set them on
        the problem, replacing any existing tags. Blank names are skipped."""
        tags = [
            Tag.objects.get_or_create(name=name.strip())[0]
            for name in tag_names
            if name.strip()
        ]
        problem.tags.set(tags)

    def create(self, validated_data):
        """Create a problem together with its nested test cases and tags."""
        test_cases_data = validated_data.pop("test_cases", [])
        tag_names = validated_data.pop("tags", [])

        problem = Problem.objects.create(**validated_data)
        for tc in test_cases_data:
            TestCase.objects.create(problem=problem, **tc)
        self._set_tags(problem, tag_names)
        return problem

    def update(self, instance, validated_data):
        """Update a problem. If ``test_cases`` is provided it fully replaces the
        existing set (old cases are deleted); tags are replaced when provided.
        Omitting either leaves that relation untouched."""
        test_cases_data = validated_data.pop("test_cases", None)
        tag_names = validated_data.pop("tags", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if test_cases_data is not None:
            instance.test_cases.all().delete()
            for tc in test_cases_data:
                TestCase.objects.create(problem=instance, **tc)

        if tag_names is not None:
            self._set_tags(instance, tag_names)

        return instance


class RecommendedProblemSerializer(serializers.ModelSerializer):
    """Slim problem representation for the dashboard Recommended block.

    Reuses ProblemSerializer's acceptance logic: it reads the
    total_submissions / ac_submissions annotations the view adds.
    """

    tags = serializers.SlugRelatedField(many=True, slug_field="name", read_only=True)
    acceptance = serializers.SerializerMethodField()

    class Meta:
        model = Problem
        fields = ["id", "title", "difficulty", "tags", "acceptance"]

    def get_acceptance(self, obj) -> float:
        total = getattr(obj, "total_submissions", 0) or 0
        if total == 0:
            return 0.0
        ac = getattr(obj, "ac_submissions", 0) or 0
        return round(ac / total * 100, 1)


class ProblemReportCreateSerializer(serializers.ModelSerializer):
    """Input for POST /api/problems/{id}/report/ — just the two fields a human
    fills in. ``problem``, ``user``, ``problem_title`` and ``status`` are all
    set by the view, never accepted from the request body.
    """

    class Meta:
        model = ProblemReport
        fields = ["reason", "message"]

    def validate_message(self, value):
        message = value.strip()
        if len(message) < MIN_REPORT_MESSAGE_LENGTH:
            raise serializers.ValidationError(
                f"Please describe the issue in at least "
                f"{MIN_REPORT_MESSAGE_LENGTH} characters."
            )
        if len(message) > MAX_REPORT_MESSAGE_LENGTH:
            raise serializers.ValidationError(
                f"Please keep the description under "
                f"{MAX_REPORT_MESSAGE_LENGTH} characters."
            )
        return message


class ProblemReportSerializer(serializers.ModelSerializer):
    """Full report as seen by staff on /api/reports/."""

    user = serializers.SlugRelatedField(slug_field="username", read_only=True)
    resolved_by = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = ProblemReport
        fields = [
            "id",
            "problem",
            "problem_title",
            "user",
            "reason",
            "message",
            "status",
            "created_at",
            "resolved_by",
            "resolved_at",
        ]
        read_only_fields = fields
