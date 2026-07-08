import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// useProblems is the one hook with real branching: page-1 reload on params
// change, append-on-loadMore, a generation guard that drops stale responses,
// and a fetching latch that blocks overlapping loadMore calls.
const { getProblems } = vi.hoisted(() => ({ getProblems: vi.fn() }));
vi.mock('../api/problems', () => ({ getProblems }));

import { useProblems } from './useProblems';

// A resolvable promise so a test can control when a fetch settles.
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const page = (results, next) => ({ results, count: 99, next });

// The hook reloads whenever `params` changes by reference, so tests must hold a
// stable object across re-renders (the real callers pass a memoised one).
const PARAMS = { ordering: 'name' };

beforeEach(() => {
  getProblems.mockReset();
});

describe('useProblems', () => {
  it('loads page 1 and exposes hasMore from `next`', async () => {
    getProblems.mockResolvedValue(page([{ id: 1 }], 'url?page=2'));

    const { result } = renderHook(() => useProblems(PARAMS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getProblems).toHaveBeenCalledWith({ ordering: 'name', page: 1 });
    expect(result.current.items).toEqual([{ id: 1 }]);
    expect(result.current.total).toBe(99);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page on loadMore and clears hasMore at the end', async () => {
    getProblems
      .mockResolvedValueOnce(page([{ id: 1 }], 'url?page=2'))
      .mockResolvedValueOnce(page([{ id: 2 }], null));

    const { result } = renderHook(() => useProblems(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
    });

    expect(getProblems).toHaveBeenLastCalledWith({ ordering: 'name', page: 2 });
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current.hasMore).toBe(false);
  });

  it('ignores a second loadMore while the first is still in flight', async () => {
    const nextPage = deferred();
    getProblems
      .mockResolvedValueOnce(page([{ id: 1 }], 'url?page=2'))
      .mockReturnValueOnce(nextPage.promise);

    const { result } = renderHook(() => useProblems(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore(); // takes the fetching latch
      result.current.loadMore(); // blocked, must not fire a request
    });
    expect(getProblems).toHaveBeenCalledTimes(2); // page 1 + one page 2

    // Latch releases once the page settles; a later loadMore works again.
    await act(async () => {
      nextPage.resolve(page([{ id: 2 }], 'url?page=3'));
    });
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('does not loadMore when hasMore is false', async () => {
    getProblems.mockResolvedValue(page([{ id: 1 }], null));

    const { result } = renderHook(() => useProblems(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
    });
    expect(getProblems).toHaveBeenCalledTimes(1);
  });

  it('reloads from page 1 when params change', async () => {
    getProblems.mockResolvedValue(page([{ id: 1 }], null));

    const { result, rerender } = renderHook(({ p }) => useProblems(p), {
      initialProps: { p: { ordering: 'name' } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    getProblems.mockResolvedValue(page([{ id: 9 }], null));
    rerender({ p: { ordering: '-acceptance' } });

    await waitFor(() => expect(result.current.items).toEqual([{ id: 9 }]));
    expect(getProblems).toHaveBeenLastCalledWith({
      ordering: '-acceptance',
      page: 1,
    });
  });

  it('drops a stale reload response when params changed mid-flight', async () => {
    const first = deferred();
    const second = deferred();
    getProblems
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ p }) => useProblems(p), {
      initialProps: { p: { ordering: 'name' } },
    });

    // Kick off the second load before the first settles.
    rerender({ p: { ordering: '-acceptance' } });

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
