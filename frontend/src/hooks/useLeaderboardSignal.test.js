import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { createWsTicket } = vi.hoisted(() => ({ createWsTicket: vi.fn() }));
vi.mock('../api/ws', () => ({
  createWsTicket,
  wsUrl: (path, ticket) => `ws://localhost${path}?ticket=${ticket}`,
}));

import { useLeaderboardSignal } from './useLeaderboardSignal';

// Minimal WebSocket stand-in: the test drives onopen/onmessage/onclose by hand.
class FakeSocket {
  static instances = [];
  static OPEN = 1;
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.send = vi.fn();
    this.close = vi.fn(() => {
      this.readyState = 3;
      this.onclose?.();
    });
    FakeSocket.instances.push(this);
  }
  emit(data) {
    this.onmessage({ data: JSON.stringify(data) });
  }
}

const sockets = () => FakeSocket.instances;
const last = () => FakeSocket.instances.at(-1);

beforeEach(() => {
  createWsTicket.mockReset().mockResolvedValue('tkt');
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useLeaderboardSignal', () => {
  it('does not connect while disabled', async () => {
    renderHook(() => useLeaderboardSignal(5, false));
    await new Promise((r) => setTimeout(r, 10));
    expect(sockets()).toHaveLength(0);
    expect(createWsTicket).not.toHaveBeenCalled();
  });

  it('connects with the ticket and bumps the signal on each update', async () => {
    const { result } = renderHook(() => useLeaderboardSignal(5, true));
    await waitFor(() => expect(sockets()).toHaveLength(1));
    expect(last().url).toBe('ws://localhost/ws/contests/5/?ticket=tkt');

    act(() => last().onopen?.());
    act(() => last().emit({ type: 'leaderboard_update' }));
    act(() => last().onmessage({ data: 'not json' })); // junk ignored
    act(() => last().emit({ type: 'leaderboard_update' }));

    expect(result.current.signal).toBe(2);
    expect(result.current.ended).toBe(false);
  });

  it('marks ended on contest_ended and does not reconnect', async () => {
    const { result } = renderHook(() => useLeaderboardSignal(5, true));
    await waitFor(() => expect(sockets()).toHaveLength(1));

    act(() => last().emit({ type: 'contest_ended' }));
    expect(result.current.ended).toBe(true);

    act(() => last().onclose()); // the server closes right after ending
    await new Promise((r) => setTimeout(r, 20));
    expect(sockets()).toHaveLength(1); // no reconnect
  });

  it('reconnects with a fresh ticket after an unexpected drop', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // zero backoff delay
    createWsTicket
      .mockReset()
      .mockResolvedValueOnce('t1')
      .mockResolvedValueOnce('t2');

    renderHook(() => useLeaderboardSignal(5, true));
    await waitFor(() => expect(sockets()).toHaveLength(1));
    expect(last().url).toContain('ticket=t1');

    act(() => last().onclose()); // unexpected drop
    await waitFor(() => expect(sockets()).toHaveLength(2));
    expect(last().url).toContain('ticket=t2');

    Math.random.mockRestore();
  });

  it('resets ended and reconnects when the contest id changes', async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useLeaderboardSignal(id, true),
      { initialProps: { id: 5 } }
    );
    await waitFor(() => expect(sockets()).toHaveLength(1));

    act(() => last().emit({ type: 'contest_ended' }));
    expect(result.current.ended).toBe(true);

    rerender({ id: 6 });
    expect(result.current.ended).toBe(false);
    await waitFor(() => expect(sockets()).toHaveLength(2));
    expect(last().url).toContain('/ws/contests/6/');
  });

  it('closes the socket and stops reconnecting on unmount', async () => {
    const { unmount } = renderHook(() => useLeaderboardSignal(5, true));
    await waitFor(() => expect(sockets()).toHaveLength(1));
    const socket = last();

    unmount();
    expect(socket.close).toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 20));
    expect(sockets()).toHaveLength(1);
  });
});
