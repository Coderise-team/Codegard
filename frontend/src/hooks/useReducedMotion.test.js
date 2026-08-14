import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useReducedMotion } from './useReducedMotion';

const original = window.matchMedia;

// A media query the test can answer for, and change its mind about later.
function stubMatchMedia(matches) {
  const listeners = new Set();
  window.matchMedia = vi.fn(() => ({
    matches,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  }));
  return {
    listeners,
    set: (next) => act(() => listeners.forEach((fn) => fn({ matches: next }))),
  };
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    window.matchMedia = original;
  });
  afterEach(() => {
    window.matchMedia = original;
    vi.restoreAllMocks();
  });

  it('reads the setting the viewer already has', () => {
    stubMatchMedia(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });

  it('follows the setting being changed, without a reload', () => {
    const query = stubMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    query.set(true);
    expect(result.current).toBe(true);

    query.set(false);
    expect(result.current).toBe(false);
  });

  it('stops listening once it is gone', () => {
    const query = stubMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(query.listeners.size).toBe(1);

    unmount();

    expect(query.listeners.size).toBe(0);
  });

  it('assumes motion is welcome where the setting cannot be read', () => {
    window.matchMedia = undefined;
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });
});
