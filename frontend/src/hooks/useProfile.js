import { useCallback, useEffect, useState } from 'react';

import { getUser, getEloHistory } from '../api/users';

// Loads ProfileCard data: the user (ELO + rank) and their rating history,
// fetched in parallel. `refetch` re-runs both requests, which is how the header
// picks up an edit made in the settings dialog; it leaves `loading` alone so the
// page doesn't fall back to the loading state over data that is already shown.
export function useProfile(username) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!username) return undefined;
    let active = true;
    Promise.all([getUser(username), getEloHistory(username)])
      .then(([user, history]) => active && setData({ user, history }))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [username, reloads]);

  const refetch = useCallback(() => setReloads((n) => n + 1), []);

  return { data, loading, error, refetch };
}
