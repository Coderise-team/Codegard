import { useEffect, useState } from 'react';

import { getUserSubmissions } from '../api/users';

// Loads a user's latest submissions (newest first, no source code). `pageSize`
// is forwarded to the endpoint (the dashboard block asks for 6).
export function useUserSubmissions(username, pageSize) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return undefined;
    let active = true;
    getUserSubmissions(username, pageSize)
      .then((subs) => active && setData(subs))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [username, pageSize]);

  return { data, loading, error };
}
