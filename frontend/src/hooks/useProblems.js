import { useCallback, useEffect, useRef, useState } from 'react';

import { getProblems } from '../api/problems';

// Infinite-scroll loader for the catalog. `params` holds the filters/sort
// (WITHOUT page) — pass a memoised object. On a params change it reloads from
// page 1; loadMore() appends the next page. `hasMore` mirrors the API's `next`.
export function useProblems(params) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageRef = useRef(1);
  const genRef = useRef(0); // bumped on every params change; guards stale responses
  const fetchingRef = useRef(false);

  // reload from page 1 whenever the filters/sort change
  useEffect(() => {
    genRef.current += 1;
    const gen = genRef.current;
    pageRef.current = 1;
    getProblems({ ...params, page: 1 })
      .then((res) => {
        if (gen !== genRef.current) return;
        setItems(res.results);
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
  }, [params]);

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    const gen = genRef.current;
    const nextPage = pageRef.current + 1;
    getProblems({ ...params, page: nextPage })
      .then((res) => {
        if (gen !== genRef.current) return; // params changed mid-flight → drop
        pageRef.current = nextPage;
        setItems((prev) => [...prev, ...res.results]);
        setHasMore(Boolean(res.next));
      })
      .catch((err) => {
        if (gen === genRef.current) setError(err);
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [params, hasMore]);

  return { items, total, hasMore, loading, error, loadMore };
}
