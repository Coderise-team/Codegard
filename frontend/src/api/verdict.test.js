import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { post, getSubmission } = vi.hoisted(() => ({
  post: vi.fn(),
  getSubmission: vi.fn(),
}));
vi.mock('./client', () => ({ default: { post } }));
vi.mock('./submissions', () => ({ getSubmission }));

import { waitForVerdict } from './verdict';

// Minimal WebSocket stand-in: the test drives onmessage/onclose by hand.
class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.close = vi.fn();
    FakeSocket.instances.push(this);
  }
}

const lastSocket = () => FakeSocket.instances.at(-1);
const openedSocket = () =>
  vi.waitFor(() => {
    expect(FakeSocket.instances.length).toBeGreaterThan(0);
    return lastSocket();
  });

beforeEach(() => {
  post.mockReset();
  getSubmission.mockReset();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('waitForVerdict', () => {
  it('resolves with the verdict pushed over the ticket socket', async () => {
    post.mockResolvedValue({ data: { ticket: 't0ken', expires_in: 30 } });

    const promise = waitForVerdict(5);
    const socket = await openedSocket();

    expect(post).toHaveBeenCalledWith('ws-ticket/');
    expect(socket.url).toContain('/ws/submissions/5/?ticket=t0ken');

    socket.onmessage({
      data: JSON.stringify({ type: 'submission_update', verdict: 'AC' }),
    });
    await expect(promise).resolves.toBe('AC');
    expect(socket.close).toHaveBeenCalled();
  });

  it('keeps waiting on the replayed null verdict and ignores junk frames', async () => {
    post.mockResolvedValue({ data: { ticket: 't', expires_in: 30 } });

    const promise = waitForVerdict(5);
    const socket = await openedSocket();

    socket.onmessage({
      data: JSON.stringify({ type: 'submission_update', verdict: null }),
    });
    socket.onmessage({ data: 'not json at all' });
    socket.onmessage({
      data: JSON.stringify({ type: 'submission_update', verdict: 'WA' }),
    });
    await expect(promise).resolves.toBe('WA');
  });

  it('falls back to polling when the ticket cannot be issued', async () => {
    vi.useFakeTimers();
    post.mockRejectedValue(new Error('404: endpoint not deployed'));
    getSubmission
      .mockResolvedValueOnce({ verdict: null })
      .mockResolvedValueOnce({ verdict: 'AC' });

    const promise = waitForVerdict(7);
    await vi.advanceTimersByTimeAsync(1500);

    await expect(promise).resolves.toBe('AC');
    expect(FakeSocket.instances).toHaveLength(0);
    expect(getSubmission).toHaveBeenCalledTimes(2);
  });

  it('falls back to polling when the socket closes without a verdict', async () => {
    post.mockResolvedValue({ data: { ticket: 't', expires_in: 30 } });
    getSubmission.mockResolvedValue({ verdict: 'TLE' });

    const promise = waitForVerdict(9);
    const socket = await openedSocket();

    socket.onclose(); // e.g. 4001 while the ticket middleware is not merged
    await expect(promise).resolves.toBe('TLE');
  });
});
