import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { getNotifications } = vi.hoisted(() => ({ getNotifications: vi.fn() }));
vi.mock('../api/notifications', () => ({ getNotifications }));

import { useNotificationFeed } from './useNotificationFeed';
import { useNotificationsStore } from '../store/notificationsStore';

const row = (id, seen = false) => ({
  id,
  type: 'new_problem',
  title: 'New problem',
  body: `Problem ${id} is now available`,
  link: `/problems/${id}`,
  seen_at: seen ? '2026-10-01T10:00:00Z' : null,
  created_at: '2026-10-01T09:00:00Z',
});

const page = (rows, next = null) => ({
  count: rows.length,
  next,
  results: rows,
});

// A promise the test settles by hand, to land an answer at a chosen moment.
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const renderFeed = (open = true) =>
  renderHook(({ on }) => useNotificationFeed(on), {
    initialProps: { on: open },
  });

const ring = () => act(() => useNotificationsStore.getState().noteRing());

const ids = (result) => result.current.items.map((n) => n.id);

beforeEach(() => {
  getNotifications.mockReset();
});

describe('useNotificationFeed', () => {
  it('asks for nothing while the panel is closed', () => {
    const { result } = renderFeed(false);

    expect(getNotifications).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('loads the newest page on opening and marks the unseen rows fresh', async () => {
    getNotifications.mockResolvedValue(page([row(3), row(2, true)], 'p2'));
    const { result } = renderFeed();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getNotifications).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.items.map((n) => [n.id, n.fresh])).toEqual([
      [3, true],
      [2, false],
    ]);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page and skips rows it already has', async () => {
    getNotifications
      .mockResolvedValueOnce(page([row(5), row(4)], 'p2'))
      .mockResolvedValueOnce(page([row(4), row(3)]));
    const { result } = renderFeed();
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(3));

    expect(getNotifications).toHaveBeenLastCalledWith({ page: 2 });
    expect(ids(result)).toEqual([5, 4, 3]);
    expect(result.current.hasMore).toBe(false);
  });

  it('sends one request for the next page however often it is asked', async () => {
    const more = deferred();
    getNotifications
      .mockResolvedValueOnce(page([row(2)], 'p2'))
      .mockReturnValueOnce(more.promise);
    const { result } = renderFeed();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());
    act(() => result.current.loadMore());
    more.resolve(page([row(1)]));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(getNotifications).toHaveBeenCalledTimes(2);
  });

  it('keeps the rows on screen when the next page fails to load', async () => {
    getNotifications
      .mockResolvedValueOnce(page([row(2)], 'p2'))
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderFeed();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(ids(result)).toEqual([2]);
    expect(result.current.hasMore).toBe(true);
  });

  it('a ring while open puts new rows on top and keeps the marks on screen', async () => {
    getNotifications
      .mockResolvedValueOnce(page([row(2), row(1)]))
      // By now the server has 1 and 2 as seen; the panel must not care.
      .mockResolvedValueOnce(page([row(3), row(2, true), row(1, true)]));
    const { result } = renderFeed();
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    ring();
    await waitFor(() => expect(result.current.items).toHaveLength(3));

    expect(getNotifications).toHaveBeenLastCalledWith({ page: 1 });
    expect(result.current.items.map((n) => [n.id, n.fresh])).toEqual([
      [3, true],
      [2, true],
      [1, true],
    ]);
  });

  it('a ring while closed asks for nothing', () => {
    renderFeed(false);

    ring();

    expect(getNotifications).not.toHaveBeenCalled();
  });

  it('closing drops the list and ignores an answer still on its way', async () => {
    const late = deferred();
    getNotifications.mockReturnValueOnce(late.promise);
    const { result, rerender } = renderFeed();

    rerender({ on: false });
    late.resolve(page([row(1)]));
    await act(() => late.promise);

    expect(result.current.items).toEqual([]);
  });

  it('opening again starts over from the server', async () => {
    getNotifications
      .mockResolvedValueOnce(page([row(1)]))
      .mockResolvedValueOnce(page([row(2), row(1, true)]));
    const { result, rerender } = renderFeed();
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    rerender({ on: false });
    rerender({ on: true });
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.items.map((n) => [n.id, n.fresh])).toEqual([
      [2, true],
      [1, false],
    ]);
  });

  it('keeps a failed first load and loads again on reload', async () => {
    getNotifications
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([row(1)]));
    const { result } = renderFeed();
    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
