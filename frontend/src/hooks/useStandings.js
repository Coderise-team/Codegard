import { useCallback, useEffect, useRef, useState } from 'react';

import { getStandings } from '../api/standings';

// Infinite-scroll loader for the global leaderboard. `params` holds the
// ordering/tier filter (WITHOUT page) — pass a memoised object. On a params
// change it reloads from page 1; loadMore() appends the next page.
//
// `count` is the number of rows matching the filter, `total` every ranked coder
// and `you` the signed-in user's own row (the API returns it on every page, so
// the floating "Your standing" bar works even when the user is not in view).
export function useStandings(params) {
  // count/total stay null until a page actually answers, so the header can keep
  // quiet instead of flashing a zero it does not know yet.
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  const [total, setTotal] = useState(null);
  const [you, setYou] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageRef = useRef(1);
  const genRef = useRef(0); // bumped on every params change; guards stale responses
  const fetchingRef = useRef(false);

  // reload from page 1 whenever the ordering/filter changes
  useEffect(() => {
    genRef.current += 1;
    const gen = genRef.current;
    pageRef.current = 1;
    getStandings({ ...params, page: 1 })
      .then((res) => {
        if (gen !== genRef.current) return;
        setItems(res.results ?? []);
        setCount(res.count ?? null);
        setTotal(res.total ?? null);
        setYou(res.you ?? null);
        setHasMore(Boolean(res.next));
        setLoading(false);
      })
      .catch((err) => {
        if (gen === genRef.current) {
          setError(err);
          setLoading(false);
        }
      });
  }, [params]);

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    const gen = genRef.current;
    const nextPage = pageRef.current + 1;
    getStandings({ ...params, page: nextPage })
      .then((res) => {
        if (gen !== genRef.current) return; // params changed mid-flight -> drop
        pageRef.current = nextPage;
        setItems((prev) => [...prev, ...(res.results ?? [])]);
        setHasMore(Boolean(res.next));
      })
      .catch((err) => {
        if (gen === genRef.current) setError(err);
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [params, hasMore]);

  return { items, count, total, you, hasMore, loading, error, loadMore };
}
