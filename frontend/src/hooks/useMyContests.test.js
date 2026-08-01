import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getContests } = vi.hoisted(() => ({ getContests: vi.fn() }));
vi.mock('../api/contests', () => ({ getContests }));

import { useMyContests } from './useMyContests';

// Fixed "now" so the finished/live/upcoming split is deterministic.
const NOW = new Date('2026-07-01T12:00:00Z').getTime();

const finished = {
  id: 1,
  start_time: '2026-05-31T10:00:00Z',
  end_time: '2026-05-31T12:00:00Z',
};
const live = {
  id: 2,
  start_time: '2026-07-01T10:00:00Z',
  end_time: '2026-07-01T14:00:00Z',
};
const soonLater = {
  id: 3,
  start_time: '2026-07-10T10:00:00Z',
  end_time: '2026-07-10T12:00:00Z',
};
const soonEarlier = {
  id: 4,
  start_time: '2026-07-05T10:00:00Z',
  end_time: '2026-07-05T12:00:00Z',
};

beforeEach(() => {
  getContests.mockReset();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => vi.restoreAllMocks());

describe('useMyContests', () => {
  it('asks for the joined contests only', async () => {
    getContests.mockResolvedValue([]);
    renderHook(() => useMyContests());
    await waitFor(() =>
      expect(getContests).toHaveBeenCalledWith({ joined: 'true' })
    );
  });

  it('drops finished contests and sorts the rest by start time', async () => {
    getContests.mockResolvedValue([soonLater, finished, live, soonEarlier]);

    const { result } = renderHook(() => useMyContests());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // finished (id 1) gone; live + upcoming sorted soonest-start first.
    expect(result.current.data.map((c) => c.id)).toEqual([2, 4, 3]);
    expect(result.current.error).toBe(null);
  });

  it('sets error and leaves data null when the fetch fails', async () => {
    const boom = new Error('contests down');
    getContests.mockRejectedValue(boom);

    const { result } = renderHook(() => useMyContests());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toBe(null);
  });
});
