from rest_framework.pagination import PageNumberPagination


class ClientPageSizePagination(PageNumberPagination):
    """Client-controlled page size — the project's default for list endpoints.

    Defaults to 20 when no size is asked, lets the client request a smaller page
    via ``?page_size=`` (the dashboard blocks ask for 5-6), and caps at 50 so a
    client can't pull a whole table at once. Shared across apps (user contest
    history, user submissions, contest list) as the house pagination standard;
    an endpoint that ever needs different limits subclasses and overrides.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50
