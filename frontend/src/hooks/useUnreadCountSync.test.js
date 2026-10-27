import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { signal } = vi.hoisted(() => ({ signal: { value: 0, enabled: [] } }));
vi.mock('./useNotificationsSignal', () => ({
  useNotificationsSignal: (enabled) => {
    signal.enabled.push(enabled);
    return signal.value;
  },
}));
vi.mock('../api/auth', () => ({}));
vi.mock('../api/client', () => ({ tokenStorage: {} }));
vi.mock('../api/notifications', () => ({}));

import { useUnreadCountSync } from './useUnreadCountSync';
import { useAuthStore } from '../store/authStore';
import { useNotificationsStore } from '../store/notificationsStore';

const refreshCount = vi.fn();
const reset = vi.fn();
let visibility = 'visible';
Object.defineProperty(document, 'visibilityState', {
  configurable: true,
  get: () => visibility,
});

const setVisibility = (state) => {
  visibility = state;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
};

const signIn = (on) =>
  act(() => useAuthStore.setState({ isAuthenticated: on }));

// A ring: the raw socket counter moves and the hook renders with it.
const ring = (rerender) => {
  signal.value += 1;
  rerender();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0); // no jitter on the pacing
  visibility = 'visible';
  signal.value = 0;
  signal.enabled = [];
  refreshCount.mockReset();
  reset.mockReset();
  useNotificationsStore.setState({ refreshCount, reset });
  useAuthStore.setState({ user: { username: 'alice' }, isAuthenticated: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useUnreadCountSync', () => {
  it('stays off the socket and the network while signed out', () => {
    useAuthStore.setState({ isAuthenticated: false });
    renderHook(() => useUnreadCountSync());

    act(() => vi.advanceTimersByTime(90000));
    setVisibility('visible');

    expect(signal.enabled.at(-1)).toBe(false);
    expect(refreshCount).not.toHaveBeenCalled();
  });

  it('asks for the count right away when signed in', () => {
    renderHook(() => useUnreadCountSync());

    expect(signal.enabled.at(-1)).toBe(true);
    expect(refreshCount).toHaveBeenCalledTimes(1);
  });

  it('turns a burst of rings into one paced request and one ring for the feed', () => {
    const { rerender } = renderHook(() => useUnreadCountSync());
    refreshCount.mockClear();
    const ringsBefore = useNotificationsStore.getState().rings;

    ring(rerender);
    ring(rerender);
    ring(rerender);
    expect(refreshCount).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1500));
    expect(refreshCount).toHaveBeenCalledTimes(1);
    expect(useNotificationsStore.getState().rings).toBe(ringsBefore + 1);
  });

  it('polls every 90 seconds only while the tab is on screen', () => {
    renderHook(() => useUnreadCountSync());
    refreshCount.mockClear();

    act(() => vi.advanceTimersByTime(90000));
    expect(refreshCount).toHaveBeenCalledTimes(1);

    visibility = 'hidden';
    act(() => vi.advanceTimersByTime(90000));
    expect(refreshCount).toHaveBeenCalledTimes(1);
  });

  it('asks again when the tab comes back on screen, not when it leaves', () => {
    renderHook(() => useUnreadCountSync());
    refreshCount.mockClear();

    setVisibility('hidden');
    expect(refreshCount).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(refreshCount).toHaveBeenCalledTimes(1);
  });

  it('clears the count, stops polling and listening once signed out', () => {
    renderHook(() => useUnreadCountSync());
    refreshCount.mockClear();
    expect(reset).not.toHaveBeenCalled();

    signIn(false);
    act(() => vi.advanceTimersByTime(90000));
    setVisibility('visible');

    expect(reset).toHaveBeenCalledTimes(1);
    expect(signal.enabled.at(-1)).toBe(false);
    expect(refreshCount).not.toHaveBeenCalled();
  });

  it('signing in again asks once, not once more for an old ring', () => {
    const { rerender } = renderHook(() => useUnreadCountSync());
    ring(rerender);
    act(() => vi.advanceTimersByTime(1500));
    signIn(false);
    refreshCount.mockClear();

    signIn(true);

    expect(refreshCount).toHaveBeenCalledTimes(1);
  });
});
