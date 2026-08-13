import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { getContests, getContest, getMyStanding } = vi.hoisted(() => ({
  getContests: vi.fn(),
  getContest: vi.fn(),
  getMyStanding: vi.fn(),
}));
vi.mock('../api/contests', () => ({ getContests, getContest, getMyStanding }));

import { useContestHero } from './useContestHero';

// getContests is asked twice, for two different statuses; answer each by the
// status it was called with rather than by call order.
const answerWith = ({ active = [], pending = [] }) =>
  getContests.mockImplementation(({ status }) =>
    Promise.resolve(status === 'active' ? active : pending)
  );

beforeEach(() => {
  getContests.mockReset();
  getContest.mockReset();
  getMyStanding.mockReset();
});

describe('useContestHero', () => {
  it('leads with a running contest and pulls what it needs to show it', async () => {
    answerWith({ active: [{ id: 7 }], pending: [{ id: 9 }] });
    getContest.mockResolvedValue({ id: 7, title: 'Round 7' });
    getMyStanding.mockResolvedValue({ rank: 3 });

    const { result } = renderHook(() => useContestHero());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('live');
    expect(result.current.data).toEqual({
      contest: { id: 7, title: 'Round 7' },
      standing: { rank: 3 },
    });
  });

  it('falls back to the soonest upcoming contest', async () => {
    // Nothing running, so the card counts down to the next round - and "next"
    // is the earliest start, not whatever the endpoint listed first.
    answerWith({
      pending: [
        { id: 2, start_time: '2026-09-01T10:00:00Z' },
        { id: 1, start_time: '2026-08-20T10:00:00Z' },
      ],
    });

    const { result } = renderHook(() => useContestHero());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('soon');
    expect(result.current.data.contest.id).toBe(1);
    // A contest that has not started has no standing to fetch.
    expect(getMyStanding).not.toHaveBeenCalled();
  });

  it('says plainly when there is nothing to show', async () => {
    answerWith({});

    const { result } = renderHook(() => useContestHero());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBe('none');
    expect(result.current.data).toBe(null);
  });

  it('keeps a failure instead of an empty card', async () => {
    const failure = new Error('boom');
    getContests.mockRejectedValue(failure);

    const { result } = renderHook(() => useContestHero());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
  });

  it('refetches on reload, which is how joining a round shows up', async () => {
    answerWith({});
    const { result } = renderHook(() => useContestHero());
    await waitFor(() => expect(result.current.state).toBe('none'));

    answerWith({ pending: [{ id: 5, start_time: '2026-09-01T10:00:00Z' }] });
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.state).toBe('soon'));
    expect(result.current.data.contest.id).toBe(5);
  });
});
