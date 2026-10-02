import { describe, it, expect, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: { getUnreadCount: vi.fn(), markSeen: vi.fn() },
}));

vi.mock('../api/notifications', () => api);
vi.mock('../api/auth', () => ({}));
vi.mock('../api/client', () => ({ tokenStorage: {} }));

import { useNotificationsStore } from './notificationsStore';
import { useAuthStore } from './authStore';

const store = () => useNotificationsStore.getState();

// A promise the test settles by hand, to put answers in any order.
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  store().reset();
  useAuthStore.setState({ user: { username: 'alice' } });
});

describe('notificationsStore', () => {
  it('refreshCount puts the server count on the bell', async () => {
    api.getUnreadCount.mockResolvedValue(3);

    await store().refreshCount();

    expect(store().count).toBe(3);
  });

  it('refreshCount keeps the last number when the request fails', async () => {
    api.getUnreadCount.mockResolvedValueOnce(3);
    await store().refreshCount();
    api.getUnreadCount.mockRejectedValueOnce(new Error('offline'));

    await store().refreshCount();

    expect(store().count).toBe(3);
  });

  it('markSeen sends the ids and takes the count left from the answer', async () => {
    api.markSeen.mockResolvedValue(30);

    await store().markSeen([812, 813]);

    expect(api.markSeen).toHaveBeenCalledWith([812, 813]);
    expect(store().count).toBe(30);
  });

  it('markSeen rejects on failure and leaves the count alone', async () => {
    api.getUnreadCount.mockResolvedValue(5);
    await store().refreshCount();
    api.markSeen.mockRejectedValue(new Error('offline'));

    await expect(store().markSeen([1])).rejects.toThrow('offline');
    expect(store().count).toBe(5);
  });

  it('drops an answer that arrives after a later-sent one', async () => {
    const refetch = deferred();
    const seen = deferred();
    api.getUnreadCount.mockReturnValue(refetch.promise);
    api.markSeen.mockReturnValue(seen.promise);

    const first = store().refreshCount();
    const second = store().markSeen([812]);
    seen.resolve(30);
    await second;
    refetch.resolve(50);
    await first;

    expect(store().count).toBe(30);
  });

  it('applies an answer that arrives after an earlier-sent one', async () => {
    const seen = deferred();
    const refetch = deferred();
    api.markSeen.mockReturnValue(seen.promise);
    api.getUnreadCount.mockReturnValue(refetch.promise);

    const first = store().markSeen([812]);
    const second = store().refreshCount();
    seen.resolve(30);
    await first;
    refetch.resolve(31);
    await second;

    expect(store().count).toBe(31);
  });

  it('logging out clears the count and ignores answers still in flight', async () => {
    api.getUnreadCount.mockResolvedValueOnce(4);
    await store().refreshCount();
    const late = deferred();
    api.getUnreadCount.mockReturnValueOnce(late.promise);
    const pending = store().refreshCount();

    useAuthStore.setState({ user: null });
    late.resolve(4);
    await pending;

    expect(store().count).toBe(0);
  });
});
