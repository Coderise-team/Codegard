import { useCallback, useEffect, useState } from 'react';

import { getContest } from '../api/contests';

// Page state derived from timestamps — the stored `status` field is a cache
// that can lag behind the clock.
export function contestState(contest, now) {
  if (now < new Date(contest.start_time).getTime()) return 'soon';
  if (now <= new Date(contest.end_time).getTime()) return 'live';
  return 'finished';
}

/**
 * Loads one contest's detail (incl. its problems) for the contest page.
 * `reload` bumps a trigger so the effect refetches (e.g. after a join).
 */
export function useContest(id) {
  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    (async () => {
      try {
        const data = await getContest(id);
        if (!active) return;
        setContest(data);
        setError(null);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { contest, loading, error, reload };
}
