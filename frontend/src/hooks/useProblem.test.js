import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getProblem } = vi.hoisted(() => ({ getProblem: vi.fn() }));
vi.mock('../api/problems', () => ({ getProblem }));

import { useProblem } from './useProblem';

beforeEach(() => {
  getProblem.mockReset();
});

describe('useProblem', () => {
  it('loads the addressed problem', async () => {
    getProblem.mockResolvedValue({ id: 42, title: 'Two Sum' });

    const { result } = renderHook(() => useProblem(42));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getProblem).toHaveBeenCalledWith(42);
    expect(result.current.data).toEqual({ id: 42, title: 'Two Sum' });
  });

  it('keeps the failure instead of half a statement', async () => {
    const failure = new Error('boom');
    getProblem.mockRejectedValue(failure);

    const { result } = renderHook(() => useProblem(42));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBe(null);
  });

  it('asks for nothing while no problem is addressed', () => {
    const { result } = renderHook(() => useProblem(null));

    expect(getProblem).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it('drops the old statement the moment the id changes', async () => {
    getProblem.mockResolvedValue({ id: 1, title: 'First' });
    const { result, rerender } = renderHook(({ id }) => useProblem(id), {
      initialProps: { id: 1 },
    });
    await waitFor(() =>
      expect(result.current.data).toEqual({
        id: 1,
        title: 'First',
      })
    );

    // Walking A -> B inside a round changes the id without a remount. Until
    // the new statement lands, the previous one must not sit on screen looking
    // like the problem that was asked for.
    let release;
    getProblem.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    rerender({ id: 2 });

    expect(result.current.data).toBe(null);
    expect(result.current.loading).toBe(true);

    release({ id: 2, title: 'Second' });
    await waitFor(() =>
      expect(result.current.data).toEqual({ id: 2, title: 'Second' })
    );
  });
});
