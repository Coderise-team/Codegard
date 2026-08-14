import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getDaily, getStreak } = vi.hoisted(() => ({
  getDaily: vi.fn(),
  getStreak: vi.fn(),
}));
vi.mock('../api/problems', () => ({ getDaily }));
vi.mock('../api/users', () => ({ getStreak }));

import { useDailyChallenge } from './useDailyChallenge';

beforeEach(() => {
  getDaily.mockReset();
  getStreak.mockReset();
});

describe('useDailyChallenge', () => {
  it('fetches the problem and the streak side by side', async () => {
    // Both are needed to draw the block, and neither depends on the other, so
    // waiting for them in turn would only make the card appear later.
    getDaily.mockResolvedValue({ id: 9, title: 'Daily' });
    getStreak.mockResolvedValue({ current_streak: 4 });

    const { result } = renderHook(() => useDailyChallenge('alice'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getStreak).toHaveBeenCalledWith('alice');
    expect(result.current.data).toEqual({
      daily: { id: 9, title: 'Daily' },
      streak: { current_streak: 4 },
    });
  });

  it('reports a failure of either half as a failure of the block', async () => {
    const failure = new Error('boom');
    getDaily.mockResolvedValue({ id: 9 });
    getStreak.mockRejectedValue(failure);

    const { result } = renderHook(() => useDailyChallenge('alice'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
    // Half a card is worse than an honest empty one.
    expect(result.current.data).toBe(null);
  });

  it('asks for nothing until it knows whose streak to ask for', () => {
    renderHook(() => useDailyChallenge(undefined));

    expect(getDaily).not.toHaveBeenCalled();
    expect(getStreak).not.toHaveBeenCalled();
  });
});
