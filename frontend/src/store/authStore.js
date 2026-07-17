import { create } from 'zustand';

import * as authApi from '../api/auth';
import { tokenStorage } from '../api/client';

export const useAuthStore = create((set) => {
  // Load the user once tokens are stored. If /me/ fails the tokens are useless
  // to us, so roll them back to keep auth state consistent; rethrow so callers
  // (login/register forms) can surface the failure.
  const loadUser = async () => {
    try {
      set({ user: await authApi.me(), isAuthenticated: true });
    } catch (error) {
      tokenStorage.clear();
      set({ user: null, isAuthenticated: false });
      throw error;
    }
  };

  return {
    user: null,
    isAuthenticated: false,
    isHydrating: true,

    // Restore the session on app start: a stored token only proves intent, so
    // verify it against the backend and load the user before trusting it.
    hydrate: async () => {
      if (!tokenStorage.getAccess()) {
        set({ isHydrating: false });
        return;
      }
      try {
        await loadUser();
      } catch {
        // Token is invalid; loadUser already cleared it.
      } finally {
        set({ isHydrating: false });
      }
    },

    login: async (credentials) => {
      tokenStorage.set(await authApi.login(credentials));
      await loadUser();
    },

    register: async (payload) => {
      tokenStorage.set(await authApi.register(payload));
      await loadUser();
    },

    // OAuth: exchange the one-time login ticket for tokens, then the usual path.
    loginWithTicket: async (ticket) => {
      tokenStorage.set(await authApi.oauthRedeem(ticket));
      await loadUser();
    },

    logout: async () => {
      const refresh = tokenStorage.getRefresh();
      try {
        if (refresh) await authApi.logout(refresh);
      } catch {
        // Server-side logout is best-effort; clear local state regardless.
      }
      tokenStorage.clear();
      set({ user: null, isAuthenticated: false });
    },
  };
});
