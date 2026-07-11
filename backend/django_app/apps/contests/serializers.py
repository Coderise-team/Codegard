from apps.problems.models import Problem
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Contest, ContestScore

User = get_user_model()


class ContestProblemSerializer(serializers.ModelSerializer):
    """
    Problem serializer for contest context.

    Important: does NOT include test cases (hidden or visible).
    """

    # Unique solvers of this problem IN THIS contest, injected as an annotation
    # by the retrieve view's prefetch (0 when the annotation is absent).
    solved_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Problem
        fields = [
            "id",
            "title",
            "description",
            "difficulty",
            "time_limit",
            "memory_limit",
            "solved_count",
        ]


class ContestRegistrantSerializer(serializers.ModelSerializer):
    """A single registered participant for the contest's "Registered" panel.

    Only username + rating — the frontend derives the rank/title from the rating
    (ranks.js), the backend neither knows nor should know titles.
    """

    class Meta:
        model = User
        fields = ["username", "elo_rating"]


class ContestSerializer(serializers.ModelSerializer):
    """Read serializer — used for list and retrieve."""

    problems_count = serializers.SerializerMethodField()
    participants_count = serializers.SerializerMethodField()
    is_joined = serializers.SerializerMethodField()

    class Meta:
        model = Contest
        fields = [
            "id",
            "title",
            "subtitle",
            "start_time",
            "end_time",
            "status",
            "problems_count",
            "participants_count",
            "is_joined",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status", "created_at", "updated_at"]

    def get_problems_count(self, obj):
        if hasattr(obj, "problems_count_annotated"):
            return obj.problems_count_annotated
        return obj.problems.count()

    def get_participants_count(self, obj):
        if hasattr(obj, "participants_count_annotated"):
            return obj.participants_count_annotated
        return obj.participants.count()

    def get_is_joined(self, obj):
        if hasattr(obj, "is_joined_annotated"):
            return obj.is_joined_annotated

        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            return obj.participants.filter(pk=request.user.pk).exists()
        return False


class ContestDetailSerializer(ContestSerializer):
    """Retrieve serializer — includes the problem list once the contest starts."""

    problems = serializers.SerializerMethodField()

    class Meta(ContestSerializer.Meta):
        fields = ContestSerializer.Meta.fields + ["problems"]

    def get_problems(self, obj):
        # Don't leak problem statements before the round begins. Gate by the
        # clock (start_time), not the cached `status`, which can lag. Once live
        # (and after finish) the full list is served, with `solved_count` from
        # the view's annotated prefetch. `problems_count` stays honest either way.
        from django.utils import timezone

        if obj.start_time and obj.start_time > timezone.now():
            return []
        return ContestProblemSerializer(obj.problems.all(), many=True).data


class ContestWriteSerializer(serializers.ModelSerializer):
    """Create / update serializer."""

    class Meta:
        model = Contest
        fields = [
            "id",
            "title",
            "subtitle",
            "start_time",
            "end_time",
            "problems",
        ]

    def validate(self, attrs):
        start = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end = attrs.get("end_time") or getattr(self.instance, "end_time", None)

        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "end_time must be after start_time."}
            )
        return attrs


# LEADERBOARD SERIALIZER


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    rank = serializers.SerializerMethodField()

    class Meta:
        model = ContestScore
        fields = [
            "rank",
            "username",
            "score",
            "penalty",
            "solved_count",
            "last_ac_at",
            "rating_delta",
        ]

    def get_rank(self, obj):
        # Rank is injected via annotated queryset in the view
        return getattr(obj, "rank", None)


# PERSONAL CONTEST DATA SERIALIZERS


class ContestHistorySerializer(serializers.ModelSerializer):
    """One past-contest row for the PastContests block (from a ContestScore)."""

    id = serializers.IntegerField(source="contest.id", read_only=True)
    title = serializers.CharField(source="contest.title", read_only=True)
    subtitle = serializers.CharField(source="contest.subtitle", read_only=True)
    end_time = serializers.DateTimeField(source="contest.end_time", read_only=True)
    solved = serializers.IntegerField(source="solved_count", read_only=True)
    rank = serializers.SerializerMethodField()
    problems_count = serializers.SerializerMethodField()

    class Meta:
        model = ContestScore
        fields = [
            "id",
            "title",
            "subtitle",
            "end_time",
            "rank",
            "solved",
            "problems_count",
            "rating_delta",
            "rating_after",
        ]

    def get_rank(self, obj):
        # Rank is injected by the view (1-based position in the leaderboard).
        return getattr(obj, "rank", None)

    def get_problems_count(self, obj) -> int:
        # Total problems in the contest, injected by get_contest_history.
        return getattr(obj, "problems_count", 0)
