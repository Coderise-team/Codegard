import { useEffect, useState } from 'react';

import { getDifficultyBreakdown } from '../api/users';

// Loads a user's solved/total problem counts per difficulty
// ({ easy, medium, hard }, each { solved, total }).
export function useDifficultyBreakdown(username) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return undefined;
    let active = true;
    getDifficultyBreakdown(username)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [username]);

  return { data, loading, error };
}
