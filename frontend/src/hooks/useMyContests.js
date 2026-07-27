import { useCallback, useEffect, useState } from 'react';

import { getContests } from '../api/contests';

// Loads the contests the current user is registered for that haven't finished
// yet (live + upcoming), soonest start first. `reload` bumps a trigger so the
// effect refetches (used after leaving a contest). Finished ones are dropped —
// they belong to the Contest History block.
export function useMyContests() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getContests({ joined: 'true' })
      .then((list) => {
        if (!active) return;
        const now = Date.now();
        const upcoming = list
          .filter((c) => new Date(c.end_time).getTime() > now)
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        setError(null);
        setData(upcoming);
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, loading, error, reload };
}
