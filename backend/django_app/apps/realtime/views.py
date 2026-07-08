from apps.realtime.tickets import WS_TICKET_TTL_SECONDS, issue_ticket
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class WSTicketView(APIView):
    """Mint a one-time ticket for authenticating a WebSocket connection.

    POST /api/ws-ticket/  (authenticated via the caller's JWT)
        -> {"ticket": "<urlsafe string>", "expires_in": 30}

    The client then opens ws://.../?ticket=<value>. No request body.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ticket = issue_ticket(request.user.id)
        return Response({"ticket": ticket, "expires_in": WS_TICKET_TTL_SECONDS})
