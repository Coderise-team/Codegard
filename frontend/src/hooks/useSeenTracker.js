import { useCallback, useEffect, useRef } from 'react';

import { useNotificationsStore } from '../store/notificationsStore';

// How often the ids collected on screen go to the server while the panel is
// open. The rest leave the moment it closes and unmounts.
const FLUSH_MS = 2000;
// The backend's limit for one /seen/ call.
const MAX_IDS_PER_CALL = 1000;
// Half a row in view is a row that was read.
const VISIBLE_SHARE = 0.5;

/**
 * Tells the server which notifications the reader actually had on screen.
 *
 * A row counts as seen once at least half of it has been in view - not when it
 * is rendered: a page brings 20 rows and maybe 15 fit, and the other 5 must
 * stay unseen. The ids are sent in batches, every two seconds while the panel
 * is mounted and once more when it unmounts, so a tab killed with the panel
 * open still keeps what was read. The answer updates the bell's count.
 *
 * Returns a ref callback for a row element carrying `data-seen-id`. Only rows
 * that are still unseen need it.
 */
export function useSeenTracker() {
  const pendingRef = useRef(new Set());
  const sentRef = useRef(new Set());
  const observerRef = useRef(null);

  useEffect(() => {
    const flush = () => {
      const ids = [...pendingRef.current];
      pendingRef.current.clear();
      for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
        const batch = ids.slice(i, i + MAX_IDS_PER_CALL);
        batch.forEach((id) => sentRef.current.add(id));
        useNotificationsStore
          .getState()
          .markSeen(batch)
          .catch(() => {
            // Offer them again with the next batch.
            batch.forEach((id) => {
              sentRef.current.delete(id);
              pendingRef.current.add(id);
            });
          });
      }
    };
    const timer = setInterval(flush, FLUSH_MS);
    return () => {
      clearInterval(timer);
      flush();
      observerRef.current?.disconnect();
    };
  }, []);

  return useCallback((node) => {
    if (!node) return undefined;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = Number(entry.target.dataset.seenId);
            if (!sentRef.current.has(id)) pendingRef.current.add(id);
            observer.unobserve(entry.target);
          });
        },
        { threshold: VISIBLE_SHARE }
      );
    }
    const observer = observerRef.current;
    observer.observe(node);
    return () => observer.unobserve(node);
  }, []);
}
