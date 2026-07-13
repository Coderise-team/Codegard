from rest_framework.pagination import PageNumberPagination


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
