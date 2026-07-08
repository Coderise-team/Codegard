import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// The single-fetch shape is covered by the representative useUserStats test;
// here we only cover what is unique to this hook: the problem filter param
// and the reload counter-trigger.
const { getSubmissions } = vi.hoisted(() => ({ getSubmissions: vi.fn() }));
vi.mock('../api/submissions', () => ({ getSubmissions }));

import { useProblemSubmissions } from './useProblemSubmissions';

beforeEach(() => {
  getSubmissions.mockReset();
});

describe('useProblemSubmissions', () => {
  it('fetches submissions filtered by the problem id', async () => {
    getSubmissions.mockResolvedValue([{ id: 1, verdict: 'AC' }]);

    const { result } = renderHook(() => useProblemSubmissions('7'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getSubmissions).toHaveBeenCalledWith({ problem: '7' });
    expect(result.current.data).toEqual([{ id: 1, verdict: 'AC' }]);
  });

  it('refetches on reload()', async () => {
    getSubmissions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 2, verdict: null }]);

    const { result } = renderHook(() => useProblemSubmissions('7'));
    await waitFor(() => expect(result.current.data).toEqual([]));

    act(() => result.current.reload());

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 2, verdict: null }])
    );
    expect(getSubmissions).toHaveBeenCalledTimes(2);
  });

  it('does not fetch without a problem id', () => {
    renderHook(() => useProblemSubmissions(undefined));
    expect(getSubmissions).not.toHaveBeenCalled();
  });
});
