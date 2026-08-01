import { useCallback, useEffect, useState } from 'react';

import { getContests, getContest, getMyStanding } from '../api/contests';

/**
 * Picks the contest for the hero card and loads what it needs:
 *   - an active contest  -> state 'live'  (+ detail and my-standing)
 *   - else next pending  -> state 'soon'
 *   - else               -> state 'none'
 * `reload` bumps a trigger so the effect refetches (after a join/leave).
 */
export function useContestHero() {
  const [state, setState] = useState(null); // 'live' | 'soon' | 'none'
  const [data, setData] = useState(null); // { contest, standing? }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [activeContests, pending] = await Promise.all([
          getContests({ status: 'active' }),
          getContests({ status: 'pending' }),
        ]);
        if (!active) return;

        if (activeContests.length > 0) {
          const id = activeContests[0].id;
          const [contest, standing] = await Promise.all([
            getContest(id),
            getMyStanding(id),
          ]);
          if (!active) return;
          setError(null);
          setState('live');
          setData({ contest, standing });
        } else if (pending.length > 0) {
          const next = [...pending].sort(
            (a, b) => new Date(a.start_time) - new Date(b.start_time)
          )[0];
          setError(null);
          setState('soon');
          setData({ contest: next });
        } else {
          setError(null);
          setState('none');
          setData(null);
        }
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { state, data, loading, error, reload };
}
