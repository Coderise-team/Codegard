import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useAuthStore } from '../store/authStore';
import { useCurrentUser } from './useCurrentUser';

beforeEach(() => {
  useAuthStore.setState({ user: null });
});

describe('useCurrentUser', () => {
  it('derives uppercase two-letter initials from the username', () => {
    useAuthStore.setState({ user: { username: 'alice' } });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current).toEqual({ username: 'alice', initials: 'AL' });
  });

  it('returns null when nobody is signed in', () => {
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toBe(null);
  });
});
