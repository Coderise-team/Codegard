import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// useProfile joins two parallel fetches into one payload. useDailyChallenge has
// the same Promise.all shape, so this covers that form too.
const { getUser, getEloHistory } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getEloHistory: vi.fn(),
}));
vi.mock('../api/users', () => ({ getUser, getEloHistory }));

import { useProfile } from './useProfile';

beforeEach(() => {
  getUser.mockReset();
  getEloHistory.mockReset();
});

describe('useProfile', () => {
  it('merges the parallel fetches into { user, history }', async () => {
    getUser.mockResolvedValue({ username: 'alice' });
    getEloHistory.mockResolvedValue([{ rating: 1500 }]);

    const { result } = renderHook(() => useProfile('alice'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({
      user: { username: 'alice' },
      history: [{ rating: 1500 }],
    });
    expect(result.current.error).toBe(null);
  });

  it('fails if either fetch rejects', async () => {
    const boom = new Error('history down');
    getUser.mockResolvedValue({ username: 'alice' });
    getEloHistory.mockRejectedValue(boom);

    const { result } = renderHook(() => useProfile('alice'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toBe(null);
  });

  it('does not fetch without a username', () => {
    renderHook(() => useProfile(undefined));
    expect(getUser).not.toHaveBeenCalled();
    expect(getEloHistory).not.toHaveBeenCalled();
  });
});
