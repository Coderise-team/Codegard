import { useEffect, useState } from 'react';

import { getSubmissions } from '../api/submissions';

// Loads the authenticated user's submissions for one problem (newest first).
// Pass `contestId` to scope them to a single round (the contest workspace);
// omit it for the training page, which shows every attempt at the problem.
// `reload` refetches after a new submission is judged (counter-trigger, no
// setState-in-effect).
//
// The list is tagged with the problem/round it was loaded for, so switching
// problems never serves the previous one's rows: until the new list lands,
// `data` is null and `loading` is true. A `reload` keeps the current list on
// screen while it refetches.
export function useProblemSubmissions(problemId, contestId) {
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  const key = `${problemId}/${contestId ?? ''}`;

  useEffect(() => {
    if (!problemId) return undefined;
    let active = true;
    getSubmissions({
      problem: problemId,
      ...(contestId != null && { contest: contestId }),
    })
      .then((subs) => active && setResult({ key, data: subs, error: null }))
      .catch(
        (err) =>
          active &&
          setResult((prev) => ({
            key,
            data: prev.key === key ? prev.data : null,
            error: err,
          }))
      );
    return () => {
      active = false;
    };
  }, [problemId, contestId, key, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const fresh = result.key === key;

  return {
    data: fresh ? result.data : null,
    loading: !fresh,
    error: fresh ? result.error : null,
    reload,
  };
}
