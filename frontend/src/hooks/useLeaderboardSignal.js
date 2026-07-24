import { useEffect, useState } from 'react';
import { createWsTicket, wsUrl } from '../api/ws';

const MAX_BACKOFF_MS = 15000;
const HEARTBEAT_MS = 25000;

/**
 * Subscribes to a contest's live channel and surfaces WHEN the leaderboard
 * changed, never the data itself. This is the "doorbell" half of variant B: the
 * socket only says "something changed"; the paginated HTTP endpoint stays the
 * single source of truth, so the realtime path and the REST path never diverge.
 *
 * Returns:
 *   signal — a counter bumped on every `leaderboard_update`; put it in a
 *            useEffect dependency to refetch the current standings page
 *   ended  — true once the round's `contest_ended` arrives
 *
 * Reconnects with a fresh ticket (single-use, ~30s TTL) and exponential backoff
 * with full jitter, so a two-hour round survives a dropped connection and a
 * fleet of clients does not reconnect in lockstep. Only connects while
 * `enabled` — the backend closes non-participants with 4003, and there is
 * nothing to show them anyway.
 */
export function useLeaderboardSignal(contestId, enabled = true) {
  const [signal, setSignal] = useState(0);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!enabled || !contestId) return undefined;

    let disposed = false;
    let endedByServer = false;
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
    // quiet round can go minutes without an event). The consumer ignores
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
      if (disposed) return;

      let ticket;
      try {
        ticket = await createWsTicket();
      } catch {
        if (!disposed) scheduleReconnect();
        return;
      }
      if (disposed) return;

      socket = new WebSocket(wsUrl(`/ws/contests/${contestId}/`, ticket));

      socket.onopen = () => {
        attempt = 0;
        startHeartbeat();
      };
      socket.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return; // ignore a malformed frame
        }
        if (msg.type === 'leaderboard_update') {
          setSignal((n) => n + 1);
        } else if (msg.type === 'contest_ended') {
          endedByServer = true;
          setEnded(true);
        }
      };
      socket.onclose = () => {
        stopHeartbeat();
        // A clean end (contest_ended) or our own teardown must not reconnect;
        // any other close is a blip we recover from.
        if (!disposed && !endedByServer) scheduleReconnect();
      };
      socket.onerror = () => {
        // Let onclose drive the reconnect; closing here avoids a half-open
        // socket lingering.
        if (socket) socket.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopHeartbeat();
      if (socket) {
        socket.onclose = null; // our teardown is not a drop — do not reconnect
        socket.close();
      }
    };
  }, [contestId, enabled]);

  return { signal, ended };
}
