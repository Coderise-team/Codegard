import client from './client';
import { getSubmission } from './submissions';

// Judging normally takes seconds; these caps only guard against a dead judge.
const WS_TIMEOUT_MS = 45000;
const POLL_TIMEOUT_MS = 90000;
const POLL_INTERVAL_MS = 1500;

// POST ws-ticket/ -> { ticket, expires_in }: a single-use short-lived ticket
// that authenticates the WebSocket handshake (the ws-ticket-auth contract;
// JWT never goes into a URL).
async function createWsTicket() {
  const { data } = await client.post('ws-ticket/');
  return data.ticket;
}

// Primary channel: the submission WebSocket. The consumer replays the current
// state on connect, so a verdict that landed before the socket opened is not
// missed.
function wsVerdict(submissionId, ticket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(
      `${proto}//${window.location.host}/ws/submissions/${submissionId}/?ticket=${encodeURIComponent(ticket)}`
    );

    let settled = false;
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      settle(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error('verdict timeout')),
      timeoutMs
    );

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // ignore a malformed frame; the timeout still guards us
      }
      // verdict is null until judged — keep waiting on the replayed state
      if (msg.type === 'submission_update' && msg.verdict) {
        finish(resolve, msg.verdict);
      }
    };
    socket.onerror = () => finish(reject, new Error('socket error'));
    socket.onclose = () => finish(reject, new Error('socket closed'));
  });
}

// Fallback channel: poll the submission until the verdict appears.
async function pollVerdict(submissionId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const submission = await getSubmission(submissionId);
    if (submission.verdict) return submission.verdict;
    if (Date.now() > deadline) throw new Error('verdict timeout');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

/**
 * Resolves with the verdict code of a freshly queued submission.
 *
 * WebSocket first (instant push); if the ticket can't be issued or the socket
 * fails or closes without a verdict (endpoint not deployed yet, proxy drop,
 * backend restart), falls back to polling. Rejects only when both channels
 * time out.
 */
export async function waitForVerdict(submissionId) {
  try {
    const ticket = await createWsTicket();
    return await wsVerdict(submissionId, ticket, WS_TIMEOUT_MS);
  } catch {
    return pollVerdict(submissionId, POLL_TIMEOUT_MS);
  }
}
