import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useAuthStore } from '../store/authStore';
import { useCurrentUser } from './useCurrentUser';

beforeEach(() => {
  useAuthStore.setState({ user: null });
});

describe('useCurrentUser', () => {
  it('hands the shell the name and the avatar url', () => {
    useAuthStore.setState({
      user: { username: 'alice', avatar: '/media/avatars/thumbs/abc.webp' },
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current).toEqual({
      username: 'alice',
      avatar: '/media/avatars/thumbs/abc.webp',
    });
  });

  it('reports a missing avatar as null', () => {
    useAuthStore.setState({ user: { username: 'alice' } });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current).toEqual({ username: 'alice', avatar: null });
  });

  it('returns null when nobody is signed in', () => {
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toBe(null);
  });
});
