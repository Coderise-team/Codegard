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
  const [items, setItems] = useState([]);
  // Null until a page actually answers: the header stays quiet rather than
  // flashing a zero it does not know yet.
  const [count, setCount] = useState(null);
  const [total, setTotal] = useState(null);
  const [you, setYou] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageRef = useRef(1);
  const genRef = useRef(0); // bumped on every params change; guards stale responses
  const fetchingRef = useRef(false);

  // Wipe the board the instant `params` change, so a new tier never shows the
  // previous one's rows (with the previous one's places) while its own page is
  // still in flight — and so a failed load doesn't keep its error on screen
  // after a later one succeeds. React's "adjust state during render" pattern:
  // it resolves before paint.
  const [shownParams, setShownParams] = useState(params);
  if (params !== shownParams) {
    setShownParams(params);
    setItems([]);
    setCount(null);
    setTotal(null);
    setYou(null);
    setHasMore(false);
    setLoading(true);
    setError(null);
  }

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
        if (gen !== genRef.current) return;
        // The rows already on screen are still good — the caller decides what to
        // do with the error, but it must not cost the reader what they have.
        // Stop offering more, though: the sentinel would otherwise sit there
        // spinning, and it will not retry on its own.
        setError(err);
        setHasMore(false);
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [params, hasMore]);

  return { items, count, total, you, hasMore, loading, error, loadMore };
}
