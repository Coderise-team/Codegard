from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandingsPagination(PageNumberPagination):
    """Standings pagination — fixed page size (global PAGE_SIZE, infinite scroll).

    Adds two keys the page needs beyond the standard envelope: ``total`` (all
    active coders, ignoring the tier filter — for the header) and ``you`` (the
    current user's own row, always present even when filtered out). Both are set
    on the paginator instance by the view before ``get_paginated_response``.
    """

    total = None
    you = None

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "total": self.total,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "you": self.you,
                "results": data,
            }
        )


class ContestHistoryPagination(PageNumberPagination):
    """Contest-history pagination with a client-controlled page size.

    Defaults to 20, but the dashboard requests ``?page_size=5`` and the future
    "all my contests" page will ask for 10-20; capped at 50.

    Deliberately a twin of contests' ``ContestListPagination`` — the task calls
    for two identical classes rather than a shared cross-app utility.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50
