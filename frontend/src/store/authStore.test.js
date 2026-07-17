import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authApi, tokenStorage } = vi.hoisted(() => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    oauthRedeem: vi.fn(),
  },
  tokenStorage: {
    getAccess: vi.fn(),
    getRefresh: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../api/auth', () => authApi);
vi.mock('../api/client', () => ({ tokenStorage }));

import { useAuthStore } from './authStore';

const store = () => useAuthStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  tokenStorage.getAccess.mockReturnValue(null);
  tokenStorage.getRefresh.mockReturnValue(null);
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isHydrating: true,
  });
});

describe('authStore', () => {
  it('login stores tokens, fetches the user and authenticates', async () => {
    authApi.login.mockResolvedValue({ access: 'a', refresh: 'r' });
    authApi.me.mockResolvedValue({ username: 'u', avatar: null });

    await store().login({ username: 'u', password: 'p' });

    expect(authApi.login).toHaveBeenCalledWith({
      username: 'u',
      password: 'p',
    });
    expect(tokenStorage.set).toHaveBeenCalledWith({
      access: 'a',
      refresh: 'r',
    });
    expect(store().user).toEqual({ username: 'u', avatar: null });
    expect(store().isAuthenticated).toBe(true);
  });

  it('register stores tokens, fetches the user and authenticates', async () => {
    authApi.register.mockResolvedValue({ access: 'a', refresh: 'r' });
    authApi.me.mockResolvedValue({ username: 'u', avatar: null });

    await store().register({ username: 'u', email: 'e', password: 'p' });

    expect(tokenStorage.set).toHaveBeenCalledWith({
      access: 'a',
      refresh: 'r',
    });
    expect(store().user).toEqual({ username: 'u', avatar: null });
    expect(store().isAuthenticated).toBe(true);
  });

  it('login rolls back tokens and rethrows when /me/ fails', async () => {
    authApi.login.mockResolvedValue({ access: 'a', refresh: 'r' });
    authApi.me.mockRejectedValue(new Error('boom'));

    await expect(
      store().login({ username: 'u', password: 'p' })
    ).rejects.toThrow('boom');

    expect(tokenStorage.set).toHaveBeenCalledWith({
      access: 'a',
      refresh: 'r',
    });
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(store().user).toBeNull();
    expect(store().isAuthenticated).toBe(false);
  });

  it('register rolls back tokens and rethrows when /me/ fails', async () => {
    authApi.register.mockResolvedValue({ access: 'a', refresh: 'r' });
    authApi.me.mockRejectedValue(new Error('boom'));

    await expect(
      store().register({ username: 'u', email: 'e', password: 'p' })
    ).rejects.toThrow('boom');

    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(store().user).toBeNull();
    expect(store().isAuthenticated).toBe(false);
  });

  it('loginWithTicket stores tokens, fetches the user and authenticates', async () => {
    authApi.oauthRedeem.mockResolvedValue({ access: 'a', refresh: 'r' });
    authApi.me.mockResolvedValue({ username: 'u', avatar: null });

    await store().loginWithTicket('t1');

    expect(authApi.oauthRedeem).toHaveBeenCalledWith('t1');
    expect(tokenStorage.set).toHaveBeenCalledWith({
      access: 'a',
      refresh: 'r',
    });
    expect(store().user).toEqual({ username: 'u', avatar: null });
    expect(store().isAuthenticated).toBe(true);
  });

  it('loginWithTicket rolls back tokens and rethrows when /me/ fails', async () => {
    authApi.oauthRedeem.mockResolvedValue({ access: 'a', refresh: 'r' });
    authApi.me.mockRejectedValue(new Error('boom'));

    await expect(store().loginWithTicket('t1')).rejects.toThrow('boom');

    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(store().user).toBeNull();
    expect(store().isAuthenticated).toBe(false);
  });

  it('hydrate fetches the user and authenticates when a token exists', async () => {
    tokenStorage.getAccess.mockReturnValue('tok');
    authApi.me.mockResolvedValue({ username: 'u', avatar: null });

    await store().hydrate();

    expect(authApi.me).toHaveBeenCalled();
    expect(store().user).toEqual({ username: 'u', avatar: null });
    expect(store().isAuthenticated).toBe(true);
    expect(store().isHydrating).toBe(false);
  });

  it('hydrate stays a guest and skips /me/ when there is no token', async () => {
    tokenStorage.getAccess.mockReturnValue(null);

    await store().hydrate();

    expect(authApi.me).not.toHaveBeenCalled();
    expect(store().isAuthenticated).toBe(false);
    expect(store().isHydrating).toBe(false);
  });

  it('hydrate clears tokens and stays a guest when /me/ fails', async () => {
    tokenStorage.getAccess.mockReturnValue('stale');
    authApi.me.mockRejectedValue(new Error('401'));

    await store().hydrate();

    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(store().user).toBeNull();
    expect(store().isAuthenticated).toBe(false);
    expect(store().isHydrating).toBe(false);
  });

  it('logout calls the API, clears tokens and resets state', async () => {
    tokenStorage.getRefresh.mockReturnValue('r');
    authApi.logout.mockResolvedValue();
    useAuthStore.setState({ user: { username: 'u' }, isAuthenticated: true });

    await store().logout();

    expect(authApi.logout).toHaveBeenCalledWith('r');
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(store().user).toBeNull();
    expect(store().isAuthenticated).toBe(false);
  });

  it('logout skips the server call when there is no refresh token', async () => {
    tokenStorage.getRefresh.mockReturnValue(null);

    await store().logout();

    expect(authApi.logout).not.toHaveBeenCalled();
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(store().isAuthenticated).toBe(false);
  });

  it('logout still clears local state when the server call fails', async () => {
    tokenStorage.getRefresh.mockReturnValue('r');
    authApi.logout.mockRejectedValue(new Error('network'));
    useAuthStore.setState({ user: { username: 'u' }, isAuthenticated: true });

    await store().logout();

    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(store().isAuthenticated).toBe(false);
  });
});
