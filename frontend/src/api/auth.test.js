import { describe, it, expect, vi, beforeEach } from 'vitest';

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('./client', () => ({ default: { post, get } }));

import { register, login, logout, me, oauthStart, oauthRedeem } from './auth';

beforeEach(() => {
  post.mockReset();
  get.mockReset();
});

describe('auth API', () => {
  it('register posts credentials and returns the response body', async () => {
    post.mockResolvedValue({ data: { access: 'a', refresh: 'r' } });

    const data = await register({
      username: 'u',
      email: 'e@x.io',
      password: 'p',
    });

    expect(post).toHaveBeenCalledWith('users/register/', {
      username: 'u',
      email: 'e@x.io',
      password: 'p',
    });
    expect(data).toEqual({ access: 'a', refresh: 'r' });
  });

  it('me fetches the current user', async () => {
    get.mockResolvedValue({ data: { username: 'u', avatar: null } });

    const data = await me();

    expect(get).toHaveBeenCalledWith('users/me/');
    expect(data).toEqual({ username: 'u', avatar: null });
  });

  it('login posts username/password and returns the body', async () => {
    post.mockResolvedValue({ data: { access: 'a', refresh: 'r' } });

    const data = await login({ username: 'u', password: 'p' });

    expect(post).toHaveBeenCalledWith('users/login/', {
      username: 'u',
      password: 'p',
    });
    expect(data).toEqual({ access: 'a', refresh: 'r' });
  });

  it('logout posts the refresh token and returns nothing', async () => {
    post.mockResolvedValue({ status: 205 });

    const result = await logout('r1');

    expect(post).toHaveBeenCalledWith('users/logout/', { refresh: 'r1' });
    expect(result).toBeUndefined();
  });

  it('oauthStart fetches the provider authorize url', async () => {
    get.mockResolvedValue({ data: { authorize_url: 'https://provider/auth' } });

    const data = await oauthStart('google');

    expect(get).toHaveBeenCalledWith('users/oauth/google/start/');
    expect(data).toEqual({ authorize_url: 'https://provider/auth' });
  });

  it('oauthRedeem posts the ticket and returns the token pair', async () => {
    post.mockResolvedValue({ data: { access: 'a', refresh: 'r' } });

    const data = await oauthRedeem('t1');

    expect(post).toHaveBeenCalledWith('users/oauth/redeem/', { ticket: 't1' });
    expect(data).toEqual({ access: 'a', refresh: 'r' });
  });
});
