import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getContestHistory: vi.fn(),
  getDaily: vi.fn(),
  getDifficultyBreakdown: vi.fn(),
  getLanguages: vi.fn(),
  getRecommended: vi.fn(),
  getStreak: vi.fn(),
  getTags: vi.fn(),
  getUserActivity: vi.fn(),
  getUserStats: vi.fn(),
  getUserSubmissions: vi.fn(),
}));

vi.mock('../api/problems', () => ({
  getDaily: api.getDaily,
  getRecommended: api.getRecommended,
  getTags: api.getTags,
}));
vi.mock('../api/submissions', () => ({ getLanguages: api.getLanguages }));
vi.mock('../api/users', () => ({
  getContestHistory: api.getContestHistory,
  getDifficultyBreakdown: api.getDifficultyBreakdown,
  getStreak: api.getStreak,
  getUserActivity: api.getUserActivity,
  getUserStats: api.getUserStats,
  getUserSubmissions: api.getUserSubmissions,
}));

import { useContestHistory } from './useContestHistory';
import { useDaily } from './useDaily';
import { useDifficultyBreakdown } from './useDifficultyBreakdown';
import { useLanguages } from './useLanguages';
import { useRecommended } from './useRecommended';
import { useStreak } from './useStreak';
import { useTags } from './useTags';
import { useUserActivity } from './useUserActivity';
import { useUserStats } from './useUserStats';
import { useUserSubmissions } from './useUserSubmissions';

/**
 * One table for the family of single-fetch hooks.
 *
 * They are all the same hook with a different call inside: ask an endpoint,
 * expose { data, loading, error }, ignore an answer that arrives after
 * unmount. The pattern itself is picked apart in useUserStats.test.js; what
 * this table pins down is the wiring of each member - that it calls ITS OWN
 * request with ITS OWN arguments. A typo there is invisible otherwise, and it
 * is the one thing that cannot be shared between them.
 *
 * When a member grows behaviour of its own, it leaves the table and gets its
 * own file. That is the point of the table, not an exception to it.
 */
const hooks = [
  { name: 'useDaily', use: () => useDaily(), call: api.getDaily, args: [] },
  { name: 'useTags', use: () => useTags(), call: api.getTags, args: [] },
  {
    name: 'useRecommended',
    use: () => useRecommended(),
    call: api.getRecommended,
    args: [],
  },
  {
    name: 'useLanguages',
    use: () => useLanguages(),
    call: api.getLanguages,
    args: [],
  },
  {
    name: 'useStreak',
    use: (name) => useStreak(name),
    call: api.getStreak,
    args: ['alice'],
    needsUser: true,
  },
  {
    name: 'useUserStats',
    use: (name) => useUserStats(name),
    call: api.getUserStats,
    args: ['alice'],
    needsUser: true,
  },
  {
    name: 'useUserActivity',
    use: (name) => useUserActivity(name),
    call: api.getUserActivity,
    args: ['alice'],
    needsUser: true,
  },
  {
    name: 'useDifficultyBreakdown',
    use: (name) => useDifficultyBreakdown(name),
    call: api.getDifficultyBreakdown,
    args: ['alice'],
    needsUser: true,
  },
  {
    name: 'useContestHistory',
    use: (name) => useContestHistory(name),
    call: api.getContestHistory,
    args: ['alice'],
    needsUser: true,
  },
  {
    // The only member that forwards a second argument: the dashboard block
    // asks for a shorter page than the profile does.
    name: 'useUserSubmissions',
    use: (name) => useUserSubmissions(name, 6),
    call: api.getUserSubmissions,
    args: ['alice', 6],
    needsUser: true,
  },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe.each(hooks)('$name', ({ use, call, args, needsUser }) => {
  it('calls its own request and exposes what came back', async () => {
    call.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => use('alice'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(call).toHaveBeenCalledWith(...args);
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBe(null);
  });

  it('keeps the failure instead of pretending there is data', async () => {
    const failure = new Error('boom');
    call.mockRejectedValue(failure);

    const { result } = renderHook(() => use('alice'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBe(null);
  });

  if (needsUser) {
    it('asks for nothing until it knows whose data to ask for', () => {
      // The page renders before the username is known; firing the request with
      // `undefined` in the url would 404 and paint an error for a heartbeat.
      const { result } = renderHook(() => use(undefined));

      expect(call).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(true);
    });
  }
});
