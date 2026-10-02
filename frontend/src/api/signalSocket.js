import { createWsTicket, wsUrl } from './ws';

const MAX_BACKOFF_MS = 15000;
const HEARTBEAT_MS = 25000;

/**
 * Keeps a "doorbell" socket open on `path` until the returned stop() is called.
 *
 * Every connection - including every reconnect - authenticates with a fresh
 * ticket. A dropped socket comes back after exponential backoff with full
 * jitter, so a fleet of clients does not reconnect in lockstep; `shouldReconnect`
 * gets the close event and can veto that for a close that is final.
 *
 * Handlers:
 *   onMessage(msg)              - every frame, parsed; malformed ones are skipped
 *   onOpen({ reconnected })     - each successful open; `reconnected` is true for
 *                                 every open after the first, when anything sent
 *                                 while the line was down is lost
 *   shouldReconnect(closeEvent) - false keeps the socket closed for good
 */
export function openSignalSocket(
  path,
  { onMessage, onOpen, shouldReconnect = () => true }
) {
  let stopped = false;
  let opened = false;
  let socket = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let attempt = 0;

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  // App-level ping keeps an intermediary proxy from culling an idle socket (a
  // quiet channel can go minutes without an event). The consumers ignore
  // unknown frames, so on the server this does nothing but stay warm.
  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_MS);
  };

  const scheduleReconnect = () => {
    const ceiling = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
    attempt += 1;
    // Full jitter: a random delay in [0, ceiling] spreads reconnects out.
    reconnectTimer = setTimeout(connect, Math.random() * ceiling);
  };

  async function connect() {
    if (stopped) return;

    let ticket;
    try {
      ticket = await createWsTicket();
    } catch {
      if (!stopped) scheduleReconnect();
      return;
    }
    if (stopped) return;

    socket = new WebSocket(wsUrl(path, ticket));

    socket.onopen = () => {
      attempt = 0;
      startHeartbeat();
      onOpen?.({ reconnected: opened });
      opened = true;
    };
    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // ignore a malformed frame
      }
      onMessage?.(msg);
    };
    socket.onclose = (event) => {
      stopHeartbeat();
      if (!stopped && shouldReconnect(event)) scheduleReconnect();
    };
    socket.onerror = () => {
      // Let onclose drive the reconnect; closing here avoids a half-open
      // socket lingering.
      if (socket) socket.close();
    };
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    stopHeartbeat();
    if (socket) {
      socket.onclose = null; // our teardown is not a drop - do not reconnect
      socket.close();
    }
  };
}
