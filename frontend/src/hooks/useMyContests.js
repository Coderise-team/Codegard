import { useEffect, useState } from 'react';

import { getContests } from '../api/contests';

// Loads the contests the current user is registered for that haven't finished
// yet (live + upcoming), soonest start first. Finished ones are dropped — they
// belong to the Contest History block. Registration changes are reflected
// optimistically in the component, so no refetch is wired here.
export function useMyContests() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return { data, loading, error };
}
