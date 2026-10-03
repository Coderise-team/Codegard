import { useEffect, useState } from 'react';
import { openSignalSocket } from '../api/signalSocket';

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
 * The connection itself - tickets, reconnects, heartbeat - is openSignalSocket's,
 * so a two-hour round survives a dropped connection. Only connects while
 * `enabled` — the backend closes non-participants with 4003, and there is
 * nothing to show them anyway.
 */
export function useLeaderboardSignal(contestId, enabled = true) {
  const [signal, setSignal] = useState(0);
  const [ended, setEnded] = useState(false);

  // Adjust-during-render: the pages that mount this hook aren't remounted when
  // only the :id param changes, so a previous round's `ended` would otherwise
  // stick and keep the next round from ever connecting.
  const [prevId, setPrevId] = useState(contestId);
  if (prevId !== contestId) {
    setPrevId(contestId);
    setEnded(false);
  }

  useEffect(() => {
    if (!enabled || !contestId) return undefined;

    let endedByServer = false;

    return openSignalSocket(`/ws/contests/${contestId}/`, {
      onMessage: (msg) => {
        if (msg.type === 'leaderboard_update') {
          setSignal((n) => n + 1);
        } else if (msg.type === 'contest_ended') {
          endedByServer = true;
          setEnded(true);
        }
      },
      // A clean end (contest_ended) must not reconnect; any other close is a
      // blip we recover from.
      shouldReconnect: () => !endedByServer,
    });
  }, [contestId, enabled]);

  return { signal, ended };
}
