from rest_framework.pagination import PageNumberPagination


class ContestPanelPagination(PageNumberPagination):
    """Fixed 10-per-page for the contest side panels.

    Used by the registrants list and the contest leaderboard. The neutral name
    is deliberate so both endpoints share a single class rather than two
    identical ones.
    """

    page_size = 10
