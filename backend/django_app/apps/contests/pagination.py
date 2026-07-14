from rest_framework.pagination import PageNumberPagination


class ContestPanelPagination(PageNumberPagination):
    """Fixed 10-per-page for the contest side panels.

    Used by the registrants list and the contest leaderboard. The neutral name
    is deliberate so both endpoints share a single class rather than two
    identical ones.
    """

    page_size = 10


class ContestListPagination(PageNumberPagination):
    """Contest list / hub pagination with a client-controlled page size.

    Defaults to the global 20 (so the hub is unaffected when no size is asked),
    but the dashboard can request ``?page_size=5``; capped at 50 to stop a client
    asking for the whole table at once.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50
