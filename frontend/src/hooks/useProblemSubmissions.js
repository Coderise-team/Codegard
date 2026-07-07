import { useEffect, useState } from 'react';

import { getSubmissions } from '../api/submissions';

// Loads the authenticated user's submissions for one problem (newest first).
// `reload` refetches after a new submission is judged (counter-trigger, no
// setState-in-effect).
export function useProblemSubmissions(problemId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!problemId) return undefined;
    let active = true;
    getSubmissions({ problem: problemId })
      .then((subs) => active && setData(subs))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [problemId, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  return { data, loading, error, reload };
}
