import { useEffect, useState } from 'react';

import { getSubmissions } from '../api/submissions';

// Loads the authenticated user's submissions for one problem (newest first).
// Pass `contestId` to scope them to a single round (the contest workspace);
// omit it for the training page, which shows every attempt at the problem.
// `reload` refetches after a new submission is judged (counter-trigger, no
// setState-in-effect).
export function useProblemSubmissions(problemId, contestId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!problemId) return undefined;
    let active = true;
    getSubmissions({
      problem: problemId,
      ...(contestId != null && { contest: contestId }),
    })
      .then((subs) => active && setData(subs))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [problemId, contestId, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  return { data, loading, error, reload };
}
