import { useEffect, useState } from 'react';

import { getProblems } from '../api/problems';

// Loads one page of the problems catalog for the given (memoised) query params.
// Refetches whenever `params` changes — pass a memoised object from the caller
// so identical filters don't trigger a refetch loop.
export function useProblems(params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProblems(params)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [params]);

  return { data, loading, error };
}
