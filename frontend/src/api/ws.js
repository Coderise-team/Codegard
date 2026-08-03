import client from './client';

// POST ws-ticket/ -> { ticket, expires_in }: a single-use, short-lived ticket
// that authenticates a WebSocket handshake (the ws-ticket-auth contract; the
// JWT never goes into a URL). Each connection — including every reconnect —
// mints a fresh one, since a ticket is spent on first use.
export async function createWsTicket() {
  const { data } = await client.post('ws-ticket/');
  return data.ticket;
}

// Build a ws(s):// URL for a backend socket path, carrying the ticket in the
// query string (a browser can't set headers on a WebSocket handshake).
export function wsUrl(path, ticket) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${proto}//${host}${path}?ticket=${encodeURIComponent(ticket)}`;
}
