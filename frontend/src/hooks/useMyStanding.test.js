import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getMyStanding } = vi.hoisted(() => ({ getMyStanding: vi.fn() }));
vi.mock('../api/contests', () => ({ getMyStanding }));

import { useMyStanding } from './useMyStanding';

beforeEach(() => {
  getMyStanding.mockReset();
});

describe('useMyStanding', () => {
  it('does not fetch while disabled', () => {
    renderHook(() => useMyStanding(5, false));
    expect(getMyStanding).not.toHaveBeenCalled();
  });

  it('fetches once enabled', async () => {
    getMyStanding.mockResolvedValue({ rank: 3, problems: [] });

    const { result, rerender } = renderHook(
      ({ enabled }) => useMyStanding(5, enabled),
      { initialProps: { enabled: false } }
    );
    rerender({ enabled: true });

    await waitFor(() =>
      expect(result.current).toEqual({ rank: 3, problems: [] })
    );
  });

  it('stays null when the fetch fails', async () => {
    getMyStanding.mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useMyStanding(5, true));

    await waitFor(() => expect(getMyStanding).toHaveBeenCalled());
    expect(result.current).toBe(null);
  });
});
