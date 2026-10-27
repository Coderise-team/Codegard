import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { openSignalSocket, stop } = vi.hoisted(() => ({
  openSignalSocket: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('../api/signalSocket', () => ({ openSignalSocket }));

import { useNotificationsSignal } from './useNotificationsSignal';

// The handlers the hook handed to the socket on its latest open.
const handlers = () => openSignalSocket.mock.calls.at(-1)[1];

beforeEach(() => {
  openSignalSocket.mockReset().mockReturnValue(stop);
  stop.mockReset();
});

describe('useNotificationsSignal', () => {
  it('does not connect while disabled', () => {
    renderHook(() => useNotificationsSignal(false));

    expect(openSignalSocket).not.toHaveBeenCalled();
  });

  it('listens on the notifications channel and bumps on each ring', () => {
    const { result } = renderHook(() => useNotificationsSignal(true));

    expect(openSignalSocket.mock.calls[0][0]).toBe('/ws/notifications/');
    act(() => handlers().onMessage({ type: 'notification' }));
    act(() => handlers().onMessage({ type: 'something_else' }));
    act(() => handlers().onMessage({ type: 'notification' }));

    expect(result.current).toBe(2);
  });

  it('bumps on a reconnect but not on the first open', () => {
    const { result } = renderHook(() => useNotificationsSignal(true));

    act(() => handlers().onOpen({ reconnected: false }));
    expect(result.current).toBe(0);

    act(() => handlers().onOpen({ reconnected: true }));
    expect(result.current).toBe(1);
  });

  it('stays closed after 4001 and recovers from any other close', () => {
    renderHook(() => useNotificationsSignal(true));
    const { shouldReconnect } = handlers();

    expect(shouldReconnect({ code: 4001 })).toBe(false);
    expect(shouldReconnect({ code: 1006 })).toBe(true);
  });

  it('closes the socket when disabled or unmounted', () => {
    const { rerender, unmount } = renderHook(
      ({ on }) => useNotificationsSignal(on),
      { initialProps: { on: true } }
    );

    rerender({ on: false });
    expect(stop).toHaveBeenCalledTimes(1);

    rerender({ on: true });
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
