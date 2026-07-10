import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { getContest } = vi.hoisted(() => ({ getContest: vi.fn() }));
vi.mock('../api/contests', () => ({ getContest }));

import { useContest, contestState } from './useContest';

beforeEach(() => {
  getContest.mockReset();
});

describe('contestState', () => {
  const contest = {
    start_time: '2026-06-06T17:00:00Z',
    end_time: '2026-06-06T19:00:00Z',
  };
  const t = (iso) => new Date(iso).getTime();

  it('is soon before the start', () => {
    expect(contestState(contest, t('2026-06-06T16:59:59Z'))).toBe('soon');
  });

  it('is live from the start through the end inclusive', () => {
    expect(contestState(contest, t('2026-06-06T17:00:00Z'))).toBe('live');
    expect(contestState(contest, t('2026-06-06T19:00:00Z'))).toBe('live');
  });

  it('is finished after the end', () => {
    expect(contestState(contest, t('2026-06-06T19:00:01Z'))).toBe('finished');
  });
});

describe('useContest', () => {
  it('loads the contest detail', async () => {
    getContest.mockResolvedValue({ id: 5, title: 'Cup' });

    const { result } = renderHook(() => useContest(5));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contest).toEqual({ id: 5, title: 'Cup' });
    expect(result.current.error).toBe(null);
  });

  it('exposes the fetch error', async () => {
    const boom = new Error('down');
    getContest.mockRejectedValue(boom);

    const { result } = renderHook(() => useContest(5));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.contest).toBe(null);
  });

  it('reload refetches', async () => {
    getContest.mockResolvedValue({ id: 5 });

    const { result } = renderHook(() => useContest(5));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.reload());
    await waitFor(() => expect(getContest).toHaveBeenCalledTimes(2));
  });

  it('does not fetch without an id', () => {
    renderHook(() => useContest(undefined));
    expect(getContest).not.toHaveBeenCalled();
  });
});
