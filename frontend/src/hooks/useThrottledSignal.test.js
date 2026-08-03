import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useThrottledSignal } from './useThrottledSignal';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0); // no jitter unless a test opts in
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderPaced = () =>
  renderHook(({ raw }) => useThrottledSignal(raw), {
    initialProps: { raw: 0 },
  });

describe('useThrottledSignal', () => {
  it('waits the base delay before firing once', () => {
    const { result, rerender } = renderPaced();

    rerender({ raw: 1 });
    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(1499));
    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(1);
  });

  it('coalesces a burst of raw bumps into a single paced bump', () => {
    const { result, rerender } = renderPaced();

    rerender({ raw: 1 });
    rerender({ raw: 2 });
    rerender({ raw: 3 });

    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(1);
  });

  it('arms again for the next bump after firing', () => {
    const { result, rerender } = renderPaced();

    rerender({ raw: 1 });
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(1);

    rerender({ raw: 2 });
    expect(result.current).toBe(1); // pending, not yet fired
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(2);
  });

  it('does not fire on the initial value with no change', () => {
    const { result } = renderHook(() => useThrottledSignal(5));

    act(() => vi.advanceTimersByTime(10000));
    expect(result.current).toBe(0);
  });

  it('adds the random jitter on top of the base delay', () => {
    Math.random.mockReturnValue(1); // full jitter slice
    const { result, rerender } = renderPaced();

    rerender({ raw: 1 });
    act(() => vi.advanceTimersByTime(1500 + 2000 - 1));
    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(1);
  });
});
