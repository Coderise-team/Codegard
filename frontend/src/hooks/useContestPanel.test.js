import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// useContestPanel mirrors useContests' machinery (page-1 reload, append on
// loadMore, generation guard, fetching latch, synchronous reset) but keyed by
// (contest id, slice kind) and picking the fetcher by kind.
const { getRegistrants, getLeaderboard } = vi.hoisted(() => ({
  getRegistrants: vi.fn(),
  getLeaderboard: vi.fn(),
}));
vi.mock('../api/contests', () => ({ getRegistrants, getLeaderboard }));

import { useContestPanel } from './useContestPanel';

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const page = (results, next) => ({ results, count: 33, next });

beforeEach(() => {
  getRegistrants.mockReset();
  getLeaderboard.mockReset();
});

describe('useContestPanel', () => {
  it('fetches nothing while kind is null', () => {
    renderHook(() => useContestPanel(5, null));
    expect(getRegistrants).not.toHaveBeenCalled();
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it('loads registrants page 1 and exposes total and hasMore', async () => {
    getRegistrants.mockResolvedValue(page([{ username: 'a' }], 'url?page=2'));

    const { result } = renderHook(() => useContestPanel(5, 'registrants'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getRegistrants).toHaveBeenCalledWith(5, { page: 1 });
    expect(result.current.rows).toEqual([{ username: 'a' }]);
    expect(result.current.total).toBe(33);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page on loadMore and clears hasMore at the end', async () => {
    getLeaderboard
      .mockResolvedValueOnce(page([{ rank: 1 }], 'url?page=2'))
      .mockResolvedValueOnce(page([{ rank: 11 }], null));

    const { result } = renderHook(() => useContestPanel(5, 'leaderboard'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
    });

    expect(getLeaderboard).toHaveBeenLastCalledWith(5, { page: 2 });
    expect(result.current.rows).toEqual([{ rank: 1 }, { rank: 11 }]);
    expect(result.current.hasMore).toBe(false);
  });

  it('ignores a second loadMore while the first is still in flight', async () => {
    const nextPage = deferred();
    getLeaderboard
      .mockResolvedValueOnce(page([{ rank: 1 }], 'url?page=2'))
      .mockReturnValueOnce(nextPage.promise);

    const { result } = renderHook(() => useContestPanel(5, 'leaderboard'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(getLeaderboard).toHaveBeenCalledTimes(2); // page 1 + one page 2

    await act(async () => {
      nextPage.resolve(page([{ rank: 11 }], null));
    });
    expect(result.current.rows).toEqual([{ rank: 1 }, { rank: 11 }]);
  });

  it('switching the slice resets synchronously and refetches from page 1', async () => {
    getRegistrants.mockResolvedValue(page([{ username: 'a' }], null));
    getLeaderboard.mockResolvedValue(page([{ rank: 1 }], null));

    const { result, rerender } = renderHook(
      ({ kind }) => useContestPanel(5, kind),
      { initialProps: { kind: 'registrants' } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The contest goes live: the source flips without flashing old rows.
    rerender({ kind: 'leaderboard' });
    expect(result.current.rows).toEqual([]);
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.rows).toEqual([{ rank: 1 }]));
    expect(getLeaderboard).toHaveBeenCalledWith(5, { page: 1 });
  });

  it('reload refetches the first page in place', async () => {
    getRegistrants.mockResolvedValue(page([{ username: 'a' }], null));

    const { result } = renderHook(() => useContestPanel(5, 'registrants'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    getRegistrants.mockResolvedValue(
      page([{ username: 'a' }, { username: 'me' }], null)
    );
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.rows.length).toBe(2));
    expect(getRegistrants).toHaveBeenLastCalledWith(5, { page: 1 });
  });

  it('drops a stale response when the slice changed mid-flight', async () => {
    const regs = deferred();
    getRegistrants.mockReturnValueOnce(regs.promise);
    getLeaderboard.mockResolvedValue(page([{ rank: 1 }], null));

    const { result, rerender } = renderHook(
      ({ kind }) => useContestPanel(5, kind),
      { initialProps: { kind: 'registrants' } }
    );

    rerender({ kind: 'leaderboard' });
    await waitFor(() => expect(result.current.rows).toEqual([{ rank: 1 }]));

    await act(async () => {
      regs.resolve(page([{ username: 'stale' }], 'url?page=2'));
    });
    expect(result.current.rows).toEqual([{ rank: 1 }]);
    expect(result.current.hasMore).toBe(false);
  });
});
