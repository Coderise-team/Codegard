import { useCallback, useEffect, useRef, useState } from 'react';

import { getNotifications } from '../api/notifications';
import { useNotificationsStore } from '../store/notificationsStore';

// Adds rows that are not on the list yet; a row already there keeps its place
// and its `fresh` mark. New rows on top of page 1 push the older ones down the
// pages, so a later page can repeat rows the list already has.
function merge(list, rows, { atTop }) {
  const known = new Set(list.map((n) => n.id));
  const added = rows
    .filter((n) => !known.has(n.id))
    .map((n) => ({ ...n, fresh: n.seen_at === null }));
  return atTop ? [...added, ...list] : [...list, ...added];
}

/**
 * The feed behind the bell, for the panel that mounts it.
 *
 * Mounting loads the newest page; scrolling down appends the next ones. A ring
 * fetches page 1 again and puts anything new on top, without touching what is
 * already on screen.
 *
 * Every row carries `fresh`: it was unseen when it arrived. The mark lives as
 * long as the panel does, even after the row is marked as seen on the server,
 * so a reader can tell what is new for as long as they are looking. The next
 * panel starts over from the server.
 *
 * Returns { items, loading, error, hasMore, loadMore, reload }.
 */
export function useNotificationFeed() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const rings = useNotificationsStore((s) => s.rings);

  const pageRef = useRef(1);
  const genRef = useRef(0); // bumped on every (re)load; guards stale answers
  const fetchingRef = useRef(false);

  useEffect(() => {
    const gen = ++genRef.current;
    pageRef.current = 1;
    fetchingRef.current = false;
    getNotifications({ page: 1 })
      .then((res) => {
        if (gen !== genRef.current) return;
        // Added to, not replacing: a ring right after mounting can land first
        // with a newer row that this answer, taken a moment earlier, lacks.
        setItems((list) => merge(list, res.results, { atTop: false }));
        setHasMore(Boolean(res.next));
        setLoading(false);
      })
      .catch((err) => {
        if (gen !== genRef.current) return;
        setError(err);
        setLoading(false);
      });
  }, [attempt]);

  // Reacts to a ring, not to mounting: the first load already took page 1.
  const handledRingRef = useRef(rings);
  useEffect(() => {
    if (rings === handledRingRef.current) return;
    handledRingRef.current = rings;
    const gen = genRef.current;
    getNotifications({ page: 1 })
      .then((res) => {
        if (gen !== genRef.current) return;
        setItems((list) => merge(list, res.results, { atTop: true }));
      })
      .catch(() => {
        // The rows on screen stay; the next ring or panel tries again.
      });
  }, [rings]);

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    const gen = genRef.current;
    const nextPage = pageRef.current + 1;
    getNotifications({ page: nextPage })
      .then((res) => {
        if (gen !== genRef.current) return;
        pageRef.current = nextPage;
        setItems((list) => merge(list, res.results, { atTop: false }));
        setHasMore(Boolean(res.next));
        setError(null);
      })
      .catch((err) => {
        if (gen === genRef.current) setError(err);
      })
      .finally(() => {
        if (gen === genRef.current) fetchingRef.current = false;
      });
  }, [hasMore]);

  // Starts the list over after a failed first load.
  const reload = useCallback(() => {
    setItems([]);
    setError(null);
    setHasMore(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { items, loading, error, hasMore, loadMore, reload };
}
