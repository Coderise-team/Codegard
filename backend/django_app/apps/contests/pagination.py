from rest_framework.pagination import PageNumberPagination


class ContestPanelPagination(PageNumberPagination):
    """10-per-page for the contest side panels, with a client-settable size.

    Used by the registrants list and the contest leaderboard. The neutral name
    is deliberate so both endpoints share a single class rather than two
    identical ones — which also means ``?page_size=`` works on both.
    """

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50
