import { create } from 'zustand';

import { getUnreadCount, markSeen } from '../api/notifications';
import { useAuthStore } from './authStore';

/**
 * Unread count behind the bell, shared by every top bar that draws one.
 *
 * Two kinds of request write the number: a plain refetch and the answer to
 * "I saw these". They race - a refetch sent before a /seen/ call can come back
 * after it with the older, higher count. Every request takes a ticket when it
 * is sent, and an answer is applied only if no later-sent request has been
 * applied already.
 */
let issued = 0;
let applied = 0;

export const useNotificationsStore = create((set) => {
  const apply = (ticket, count) => {
    if (ticket <= applied) return;
    applied = ticket;
    set({ count });
  };

  return {
    count: 0,

    // Background refetch: a failure keeps the last known number, the next
    // ring, timer tick or tab return asks again.
    refreshCount: async () => {
      const ticket = ++issued;
      try {
        apply(ticket, await getUnreadCount());
      } catch {
        // Nothing to show for it; the current number stays.
      }
    },

    // Rejects on failure so the caller can offer the same ids again.
    markSeen: async (ids) => {
      const ticket = ++issued;
      apply(ticket, await markSeen(ids));
    },

    // Answers still in flight belong to the session that just ended.
    reset: () => {
      applied = issued;
      set({ count: 0 });
    },
  };
});

useAuthStore.subscribe((state, prev) => {
  if (prev.user && !state.user) useNotificationsStore.getState().reset();
});
