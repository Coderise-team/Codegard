import { useCallback, useEffect, useRef, useState } from 'react';

import { getLeaderboard, getRegistrants } from '../api/contests';

const FETCHERS = {
  registrants: getRegistrants,
  leaderboard: getLeaderboard,
};

// Infinite-scroll loader for the contest side panel. `kind` picks the slice —
// 'registrants' before the start, 'leaderboard' during/after — and may be
// null while the contest detail is still loading (nothing is fetched then).
// Reloads from page 1 when the contest or slice changes; loadMore() appends
// the next page. `hasMore` mirrors the API's `next`.
export function useContestPanel(id, kind) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageRef = useRef(1);
  const genRef = useRef(0); // bumped on every slice change; guards stale responses
  const fetchingRef = useRef(false);

  // Reset the instant the slice changes (soon -> live swaps the source) so
  // the panel never flashes the previous slice's rows. Adjust-during-render.
  const key = `${id}:${kind}`;
  const [shownKey, setShownKey] = useState(key);
  if (key !== shownKey) {
    setShownKey(key);
    setRows([]);
    setTotal(0);
    setHasMore(false);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    genRef.current += 1;
    if (!id || !kind) return;
    const gen = genRef.current;
    pageRef.current = 1;
    FETCHERS[kind](id, { page: 1 })
      .then((res) => {
        if (gen !== genRef.current) return;
        setRows(res.results);
        setTotal(res.count);
        setHasMore(Boolean(res.next));
        setLoading(false);
      })
      .catch((err) => {
        if (gen === genRef.current) {
          setError(err);
          setLoading(false);
        }
      });
  }, [id, kind]);

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    const gen = genRef.current;
    const nextPage = pageRef.current + 1;
    FETCHERS[kind](id, { page: nextPage })
      .then((res) => {
        if (gen !== genRef.current) return; // slice changed mid-flight → drop
        pageRef.current = nextPage;
        setRows((prev) => [...prev, ...res.results]);
        setHasMore(Boolean(res.next));
      })
      .catch((err) => {
        if (gen === genRef.current) setError(err);
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [id, kind, hasMore]);

  return { rows, total, hasMore, loading, error, loadMore };
}
