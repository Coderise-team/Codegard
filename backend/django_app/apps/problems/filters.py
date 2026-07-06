import django_filters

from .models import Problem


class ProblemFilter(django_filters.FilterSet):
    """Declarative filtering/ordering for the problems catalog.

    Fields that don't exist on the model (status, difficulty ordering,
    acceptance ordering) work off annotations added in the viewset's
    get_queryset (user_status / difficulty_rank / acceptance_rate).
    """

    difficulty = django_filters.ChoiceFilter(choices=Problem.Difficulty.choices)

    # ?tag=Arrays&tag=Hashing → only problems that have ALL of them (AND).
    tag = django_filters.CharFilter(method="filter_tags")

    status = django_filters.ChoiceFilter(
        method="filter_status",
        choices=[("solved", "solved"), ("attempted", "attempted"), ("todo", "todo")],
    )

    # Public ?ordering names remapped to the model field / annotation each sorts by:
    #   name       -> title (plain text field, sorts directly)
    #   difficulty -> difficulty_rank (easy<medium<hard, not alphabetical)
    #   acceptance -> acceptance_rate (ac/total, not the raw CharField)
    ordering = django_filters.OrderingFilter(
        fields=(
            ("id", "id"),
            ("title", "name"),
            ("difficulty_rank", "difficulty"),
            ("acceptance_rate", "acceptance"),
        )
    )

    class Meta:
        model = Problem
        fields = ["difficulty", "tag", "status", "ordering"]

    def filter_tags(self, queryset, name, value):
        # `tag` may be repeated; getlist gives every value. AND them together by
        # chaining .filter (each narrows further), distinct() removes M2M-join dupes.
        tags = self.request.query_params.getlist("tag")
        for tag in tags:
            queryset = queryset.filter(tags__name=tag)
        return queryset.distinct()

    def filter_status(self, queryset, name, value):
        # user_status is already annotated by the viewset; just match it.
        return queryset.filter(user_status=value)
