import django_filters
from django.contrib.postgres.search import TrigramWordSimilarity

from .models import Problem

# Queries shorter than this fall back to prefix search — a two-letter query has
# no useful trigram signal (see filter_search).
MIN_TRIGRAM_LENGTH = 3

# Minimum word-similarity for a title to count as a match. Tuned on the real
# catalog (36 LeetCode-style titles). Real matches — exact, single-word,
# 3-letter abbreviations, one-letter typos, and transpositions — all score
# >= 0.44. Long unrelated titles that happen to share a few trigrams top out
# around 0.25 (e.g. "anagrams" vs "Best Time to Buy and Sell Stock" = 0.22),
# and truly unrelated words stay <= 0.11. 0.35 sits in that gap. Per project
# rule this is a constant, not an env var.
TITLE_SEARCH_THRESHOLD = 0.35


class ProblemFilter(django_filters.FilterSet):
    """Declarative filtering/ordering for the problems catalog.

    Fields that don't exist on the model (status, difficulty ordering,
    acceptance ordering) work off annotations added in the viewset's
    get_queryset (user_status / difficulty_rank / acceptance_rate).
    """

    # Typo-tolerant title search. Composes with the other filters; when active
    # (and no explicit ?ordering) it sorts by relevance.
    search = django_filters.CharFilter(method="filter_search")

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
        fields = ["search", "difficulty", "tag", "status", "ordering"]

    def filter_search(self, queryset, name, value):
        term = (value or "").strip()
        if not term:
            # Absent/blank search leaves the catalog untouched.
            return queryset
        if len(term) < MIN_TRIGRAM_LENGTH:
            # 1–2 chars: trigram similarity is meaningless, so "starts with".
            return queryset.filter(title__istartswith=term)
        # 3+ chars: word similarity (best word inside the title), thresholded,
        # then ranked by relevance. An explicit ?ordering, applied afterwards by
        # the OrderingFilter, still wins over this.
        return (
            queryset.annotate(title_similarity=TrigramWordSimilarity(term, "title"))
            .filter(title_similarity__gte=TITLE_SEARCH_THRESHOLD)
            .order_by("-title_similarity", "id")
        )

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
