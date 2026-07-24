import { useEffect, useState } from 'react';

import { getMyStanding } from '../api/contests';

/**
 * My rank/score/solved + per-problem statuses for a contest. Fetched only
 * when `enabled` — the problem strip needs it in live/finished, not before
 * the start. On failure stays null and the strip falls back to 'open'.
 *
 * `reloadKey` refetches in place when it changes (no flash) — contest mode
 * bumps it off the live standings signal so my own rank tracks the round.
 */
export function useMyStanding(id, enabled, reloadKey = 0) {
  const [standing, setStanding] = useState(null);

  // Contests can share problems, so a stale standing could paint the previous
  // contest's statuses on the new pips. Adjust-during-render.
  const [prevId, setPrevId] = useState(id);
  if (prevId !== id) {
    setPrevId(id);
    setStanding(null);
  }

  useEffect(() => {
    if (!id || !enabled) return undefined;
    let active = true;
    getMyStanding(id)
      .then((data) => {
        if (active) setStanding(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, enabled, reloadKey]);

  return standing;
}
