import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createWsTicket } = vi.hoisted(() => ({ createWsTicket: vi.fn() }));
vi.mock('./ws', () => ({
  createWsTicket,
  wsUrl: (path, ticket) => `ws://localhost${path}?ticket=${ticket}`,
}));

import { openSignalSocket } from './signalSocket';

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
      this.onclose?.({ code: 1000 });
    });
    FakeSocket.instances.push(this);
  }
}

const sockets = () => FakeSocket.instances;
const last = () => FakeSocket.instances.at(-1);

// Lets the awaited ticket settle so the socket gets constructed.
const flush = () => vi.advanceTimersByTimeAsync(0);

let stop;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0); // zero backoff delay
  createWsTicket.mockReset().mockResolvedValue('tkt');
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('openSignalSocket', () => {
  it('opens the path with a ticket and hands over parsed frames only', async () => {
    const onMessage = vi.fn();
    stop = openSignalSocket('/ws/x/', { onMessage });
    await flush();

    expect(last().url).toBe('ws://localhost/ws/x/?ticket=tkt');
    last().onmessage({ data: 'not json' });
    last().onmessage({ data: JSON.stringify({ type: 'ring' }) });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ type: 'ring' });
  });

  it('tells the first open apart from every later one', async () => {
    const onOpen = vi.fn();
    stop = openSignalSocket('/ws/x/', { onOpen });
    await flush();
    last().onopen();

    last().onclose({ code: 1006 });
    await flush();
    last().onopen();

    expect(onOpen.mock.calls).toEqual([
      [{ reconnected: false }],
      [{ reconnected: true }],
    ]);
  });

  it('keeps the socket closed when shouldReconnect vetoes the close', async () => {
    const shouldReconnect = vi.fn((event) => event.code !== 4001);
    stop = openSignalSocket('/ws/x/', { shouldReconnect });
    await flush();

    last().onclose({ code: 4001 });
    await vi.advanceTimersByTimeAsync(20000);

    expect(shouldReconnect).toHaveBeenCalledWith({ code: 4001 });
    expect(sockets()).toHaveLength(1);
  });

  it('retries when the ticket cannot be minted', async () => {
    createWsTicket
      .mockReset()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('t2');
    stop = openSignalSocket('/ws/x/', {});
    await flush();
    await flush();

    expect(createWsTicket).toHaveBeenCalledTimes(2);
    expect(sockets()).toHaveLength(1);
    expect(last().url).toContain('ticket=t2');
  });

  it('closes on an error and lets the close drive the reconnect', async () => {
    stop = openSignalSocket('/ws/x/', {});
    await flush();
    const first = last();

    first.onerror();
    await flush();

    expect(first.close).toHaveBeenCalled();
    expect(sockets()).toHaveLength(2);
  });

  it('pings an open socket every 25 seconds and stops when it closes', async () => {
    stop = openSignalSocket('/ws/x/', {});
    await flush();
    const socket = last();
    socket.onopen();

    await vi.advanceTimersByTimeAsync(25000);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));

    socket.onclose({ code: 1006 });
    await vi.advanceTimersByTimeAsync(25000);
    expect(socket.send).toHaveBeenCalledTimes(1);
  });

  it('stop() closes the socket and nothing reconnects afterwards', async () => {
    stop = openSignalSocket('/ws/x/', {});
    await flush();
    const socket = last();

    stop();
    await vi.advanceTimersByTimeAsync(20000);

    expect(socket.close).toHaveBeenCalled();
    expect(sockets()).toHaveLength(1);
  });
});
