import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Representative single-fetch hook. useUserStats stands in for the whole family
// of `useEffect → fetch(username) → {data,loading,error}` hooks (useStreak,
// useUserSubmissions, useUserActivity, useContestHistory, ...). They share this
// exact shape, so we test the pattern once here instead of duplicating it.
const { getUserStats } = vi.hoisted(() => ({ getUserStats: vi.fn() }));
vi.mock('../api/users', () => ({ getUserStats }));

import { useUserStats } from './useUserStats';

beforeEach(() => {
  getUserStats.mockReset();
});

describe('useUserStats', () => {
  it('starts loading, then exposes the fetched data', async () => {
    getUserStats.mockResolvedValue({ solved: 12 });

    const { result } = renderHook(() => useUserStats('alice'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ solved: 12 });
    expect(result.current.error).toBe(null);
    expect(getUserStats).toHaveBeenCalledWith('alice');
  });

  it('surfaces the error and stops loading on failure', async () => {
    const boom = new Error('nope');
    getUserStats.mockRejectedValue(boom);

    const { result } = renderHook(() => useUserStats('alice'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toBe(null);
  });

  it('never sets state after unmount (active guard)', async () => {
    let resolve;
    getUserStats.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const { result, unmount } = renderHook(() => useUserStats('alice'));
    unmount();
    resolve({ solved: 1 });
    await Promise.resolve();

    // Still on the initial state: the resolve landed after the guard flipped.
    expect(result.current.data).toBe(null);
    expect(result.current.loading).toBe(true);
  });

  it('refetches when the username changes', async () => {
    getUserStats.mockResolvedValue({ solved: 1 });

    const { rerender } = renderHook(({ u }) => useUserStats(u), {
      initialProps: { u: 'alice' },
    });
    await waitFor(() => expect(getUserStats).toHaveBeenCalledWith('alice'));

    rerender({ u: 'bob' });
    await waitFor(() => expect(getUserStats).toHaveBeenCalledWith('bob'));
    expect(getUserStats).toHaveBeenCalledTimes(2);
  });

  it('does not fetch without a username', () => {
    renderHook(() => useUserStats(undefined));
    expect(getUserStats).not.toHaveBeenCalled();
  });
});
