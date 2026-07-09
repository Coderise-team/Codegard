import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// useContests mirrors useProblems: page-1 reload on params change, append on
// loadMore, a generation guard that drops stale responses, a fetching latch,
// and a reset-on-params-change so a tab switch never flashes the old rows.
const { getContestsPage } = vi.hoisted(() => ({ getContestsPage: vi.fn() }));
vi.mock('../api/contests', () => ({ getContestsPage }));

import { useContests } from './useContests';

// A resolvable promise so a test can control when a fetch settles.
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const page = (results, next) => ({ results, count: 42, next });

// The hook reloads whenever `params` changes by reference, so tests must hold a
// stable object across re-renders (the real callers pass a memoised one).
const PARAMS = { status: 'pending', ordering: 'start_time' };

beforeEach(() => {
  getContestsPage.mockReset();
});

describe('useContests', () => {
  it('loads page 1 and exposes total and hasMore from `next`', async () => {
    getContestsPage.mockResolvedValue(page([{ id: 1 }], 'url?page=2'));

    const { result } = renderHook(() => useContests(PARAMS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getContestsPage).toHaveBeenCalledWith({
      status: 'pending',
      ordering: 'start_time',
      page: 1,
    });
    expect(result.current.items).toEqual([{ id: 1 }]);
    expect(result.current.total).toBe(42);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page on loadMore and clears hasMore at the end', async () => {
    getContestsPage
      .mockResolvedValueOnce(page([{ id: 1 }], 'url?page=2'))
      .mockResolvedValueOnce(page([{ id: 2 }], null));

    const { result } = renderHook(() => useContests(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
    });

    expect(getContestsPage).toHaveBeenLastCalledWith({
      status: 'pending',
      ordering: 'start_time',
      page: 2,
    });
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current.hasMore).toBe(false);
  });

  it('ignores a second loadMore while the first is still in flight', async () => {
    const nextPage = deferred();
    getContestsPage
      .mockResolvedValueOnce(page([{ id: 1 }], 'url?page=2'))
      .mockReturnValueOnce(nextPage.promise);

    const { result } = renderHook(() => useContests(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore(); // takes the fetching latch
      result.current.loadMore(); // blocked, must not fire a request
    });
    expect(getContestsPage).toHaveBeenCalledTimes(2); // page 1 + one page 2

    await act(async () => {
      nextPage.resolve(page([{ id: 2 }], 'url?page=3'));
    });
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('does not loadMore when hasMore is false', async () => {
    getContestsPage.mockResolvedValue(page([{ id: 1 }], null));

    const { result } = renderHook(() => useContests(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
    });
    expect(getContestsPage).toHaveBeenCalledTimes(1);
  });

  it('reloads from page 1 when params change', async () => {
    getContestsPage.mockResolvedValue(page([{ id: 1 }], null));

    const { result, rerender } = renderHook(({ p }) => useContests(p), {
      initialProps: { p: { status: 'pending' } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    getContestsPage.mockResolvedValue(page([{ id: 9 }], null));
    rerender({ p: { status: 'finished' } });

    await waitFor(() => expect(result.current.items).toEqual([{ id: 9 }]));
    expect(getContestsPage).toHaveBeenLastCalledWith({
      status: 'finished',
      page: 1,
    });
  });

  it('resets to a loading state on params change so the old rows do not flash', async () => {
    const first = deferred();
    const second = deferred();
    getContestsPage
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ p }) => useContests(p), {
      initialProps: { p: { status: 'pending' } },
    });
    await act(async () => {
      first.resolve(page([{ id: 1 }], null));
    });
    expect(result.current.items).toEqual([{ id: 1 }]);
    expect(result.current.loading).toBe(false);

    // Switching tab clears the list synchronously — before the new page lands.
    rerender({ p: { status: 'finished' } });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      second.resolve(page([{ id: 9 }], null));
    });
    expect(result.current.items).toEqual([{ id: 9 }]);
    expect(result.current.loading).toBe(false);
  });

  it('drops a stale reload response when params changed mid-flight', async () => {
    const first = deferred();
    const second = deferred();
    getContestsPage
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ p }) => useContests(p), {
      initialProps: { p: { status: 'pending' } },
    });

    // Kick off the second load before the first settles.
    rerender({ p: { status: 'finished' } });

    // Newest wins even though it resolves first...
    await act(async () => {
      second.resolve(page([{ id: 9 }], null));
    });
    // ...and the stale first response is ignored when it finally lands.
    await act(async () => {
      first.resolve(page([{ id: 1 }], 'url?page=2'));
    });

    expect(result.current.items).toEqual([{ id: 9 }]);
    expect(result.current.hasMore).toBe(false);
  });
});
