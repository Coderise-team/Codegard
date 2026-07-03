import { useEffect, useState } from 'react';

import { getDaily } from '../api/problems';

// Loads today's daily challenge, or null when none is assigned yet.
// Lean sibling of useDailyChallenge (no streak) — the catalog rail only needs
// the problem summary.
export function useDaily() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getDaily()
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}
