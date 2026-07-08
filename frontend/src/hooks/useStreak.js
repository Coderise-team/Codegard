import { useEffect, useState } from 'react';

import { getStreak } from '../api/users';

// Loads a user's daily-challenge streak
// ({ current_streak, longest_streak, history }).
export function useStreak(username) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return undefined;
    let active = true;
    getStreak(username)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [username]);

  return { data, loading, error };
}
