import { useEffect, useRef } from 'react';

import { useAuthStore } from '../store/authStore';
import { useNotificationsStore } from '../store/notificationsStore';
import { useNotificationsSignal } from './useNotificationsSignal';
import { useThrottledSignal } from './useThrottledSignal';

// Safety net for a ring that never arrived: the socket is the main path, this
// only bounds how stale the number can get when the socket is down.
const POLL_MS = 90000;

const refreshCount = () => useNotificationsStore.getState().refreshCount();
const tabVisible = () => document.visibilityState === 'visible';

/**
 * Keeps the bell's unread count current for the signed-in user. Mounted once
 * for the whole app, so a page change does not drop the socket.
 *
 * The count is asked for:
 *   - right away, so a returning user sees it without waiting for a ring;
 *   - on a ring, paced so a burst of rings costs one request; the ring is also
 *     passed on to the store, for an open feed to pick up;
 *   - every 90 seconds while the tab is on screen;
 *   - when the tab comes back on screen, since nothing rings for a feed read
 *     in another tab.
 *
 * Signing out clears the count.
 */
export function useUnreadCountSync() {
  const enabled = useAuthStore((s) => s.isAuthenticated);
  const paced = useThrottledSignal(useNotificationsSignal(enabled));

  useEffect(() => {
    if (!enabled) return undefined;

    refreshCount();

    const timer = setInterval(() => {
      if (tabVisible()) refreshCount();
    }, POLL_MS);
    const onVisibility = () => {
      if (tabVisible()) refreshCount();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      // Signed out: the next account must not inherit this one's number.
      useNotificationsStore.getState().reset();
    };
  }, [enabled]);

  // Reacts to the signal moving, not to `enabled` flipping: signing in again
  // is already covered by the first request above.
  const handledRef = useRef(paced);
  useEffect(() => {
    if (paced === handledRef.current) return;
    handledRef.current = paced;
    if (!enabled) return;
    refreshCount();
    useNotificationsStore.getState().noteRing();
  }, [enabled, paced]);
}
