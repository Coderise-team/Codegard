import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// useStandings accumulates pages like useProblems, but also carries the two
// numbers (count/total) and the `you` row that ride along in every envelope.
const { getStandings } = vi.hoisted(() => ({ getStandings: vi.fn() }));
vi.mock('../api/standings', () => ({ getStandings }));

import { useStandings } from './useStandings';

// A resolvable promise so a test can control when a fetch settles.
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const YOU = { username: 'me', elo_rating: 1500, globalRank: 7 };
const page = (results, next) => ({
  results,
  count: 30,
  total: 400,
  you: YOU,
  next,
});

// The hook reloads whenever `params` changes by reference, so tests must hold a
// stable object across re-renders (the real caller passes a memoised one).
const PARAMS = { ordering: '-elo_rating' };

beforeEach(() => {
  getStandings.mockReset();
});

describe('useStandings', () => {
  it('loads page 1 with both counts and the you row', async () => {
    getStandings.mockResolvedValue(page([{ username: 'a' }], 'url?page=2'));

    const { result } = renderHook(() => useStandings(PARAMS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getStandings).toHaveBeenCalledWith({
      ordering: '-elo_rating',
      page: 1,
    });
    expect(result.current.items).toEqual([{ username: 'a' }]);
    expect(result.current.count).toBe(30); // rows under the filter
    expect(result.current.total).toBe(400); // every ranked coder
    expect(result.current.you).toEqual(YOU);
    expect(result.current.hasMore).toBe(true);
  });

  it('leaves the counts null when the response omits them', async () => {
    getStandings.mockResolvedValue({ results: [], next: null });

    const { result } = renderHook(() => useStandings(PARAMS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Null, not zero — "unknown" must not render as "no coders at all".
    expect(result.current.count).toBeNull();
    expect(result.current.total).toBeNull();
    expect(result.current.you).toBeNull();
  });

  it('appends the next page and clears hasMore at the end', async () => {
    getStandings
      .mockResolvedValueOnce(page([{ username: 'a' }], 'url?page=2'))
      .mockResolvedValueOnce(page([{ username: 'b' }], null));

    const { result } = renderHook(() => useStandings(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
    });

    expect(getStandings).toHaveBeenLastCalledWith({
      ordering: '-elo_rating',
      page: 2,
    });
    expect(result.current.items).toEqual([
      { username: 'a' },
      { username: 'b' },
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it('does not loadMore when there is no next page', async () => {
    getStandings.mockResolvedValue(page([{ username: 'a' }], null));

    const { result } = renderHook(() => useStandings(PARAMS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loadMore();
    });
    expect(getStandings).toHaveBeenCalledTimes(1);
  });

  it('reloads from page 1 when the ordering or tier changes', async () => {
    getStandings.mockResolvedValue(page([{ username: 'a' }], null));

    const { result, rerender } = renderHook(({ p }) => useStandings(p), {
      initialProps: { p: { ordering: '-elo_rating' } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    getStandings.mockResolvedValue(page([{ username: 'z' }], null));
    rerender({ p: { ordering: '-max_rating', tier: 'Expert' } });

    await waitFor(() =>
      expect(result.current.items).toEqual([{ username: 'z' }])
    );
    expect(getStandings).toHaveBeenLastCalledWith({
      ordering: '-max_rating',
      tier: 'Expert',
      page: 1,
    });
  });

  it('drops a stale response when the params changed mid-flight', async () => {
    const first = deferred();
    const second = deferred();
    getStandings
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ p }) => useStandings(p), {
      initialProps: { p: { ordering: '-elo_rating' } },
    });

    rerender({ p: { tier: 'Kernel', ordering: '-elo_rating' } });

    // Newest wins even though it resolves first...
    await act(async () => {
      second.resolve(page([{ username: 'z' }], null));
    });
    // ...and the stale first response is ignored when it finally lands.
    await act(async () => {
      first.resolve(page([{ username: 'a' }], 'url?page=2'));
    });

    expect(result.current.items).toEqual([{ username: 'z' }]);
    expect(result.current.hasMore).toBe(false);
  });

  it('surfaces a failed load as an error', async () => {
    getStandings.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStandings(PARAMS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toEqual([]);
  });

  it('clears a previous error once a later load succeeds', async () => {
    getStandings.mockRejectedValue(new Error('boom'));

    const { result, rerender } = renderHook(({ p }) => useStandings(p), {
      initialProps: { p: { ordering: '-elo_rating' } },
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());

    getStandings.mockResolvedValue(page([{ username: 'a' }], null));
    rerender({ p: { tier: 'Expert' } });

    // Without the reset the page would keep showing "Standings unavailable"
    // on top of perfectly good rows.
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it('drops the old rows the moment the params change', async () => {
    getStandings.mockResolvedValue(page([{ username: 'a' }], null));

    const { result, rerender } = renderHook(({ p }) => useStandings(p), {
      initialProps: { p: { ordering: '-elo_rating' } },
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    const next = deferred();
    getStandings.mockReturnValueOnce(next.promise);
    rerender({ p: { tier: 'Kernel' } });

    // Mid-flight: the previous tier's rows (and its counts) must already be
    // gone, not sitting on screen wearing places they no longer hold.
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      next.resolve(page([{ username: 'z' }], null));
    });
    expect(result.current.items).toEqual([{ username: 'z' }]);
    expect(result.current.loading).toBe(false);
  });
});
