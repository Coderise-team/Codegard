import { useEffect, useState } from 'react';

import { getProblem } from '../api/problems';

// Loads one full problem for the workspace (statement, limits, tags,
// visible test cases).
export function useProblem(id) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Adjust-during-render: the id can change without a remount (contest mode
  // walks A -> B in place), and until the new statement lands the previous
  // problem must not sit on screen looking like the requested one.
  const [prevId, setPrevId] = useState(id);
  if (prevId !== id) {
    setPrevId(id);
    setData(null);
    setError(null);
    setLoading(true);
  }

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    getProblem(id)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  return { data, loading, error };
}
