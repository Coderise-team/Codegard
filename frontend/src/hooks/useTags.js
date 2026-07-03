import { useEffect, useState } from 'react';

import { getTags } from '../api/problems';

// Loads all catalog tags with their problem counts ([{ name, count }]),
// for the filter dropdown.
export function useTags() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getTags()
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}
