import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('../api/notifications', () => ({}));

import { useSeenTracker } from './useSeenTracker';
import { useNotificationsStore } from '../store/notificationsStore';

// The stub from src/test/setup.js records every observer it constructs.
const IO = globalThis.IntersectionObserver;
const observer = () => IO.instances.at(-1);

const markSeen = vi.fn();

function Rows({ ids }) {
  const track = useSeenTracker();
  return (
    <ul>
      {ids.map((id) => (
        <li key={id} data-seen-id={id} ref={track} />
      ))}
    </ul>
  );
}

// Pretend these rows scrolled into view (or, with `false`, stayed out of it).
const show = (container, ids, isIntersecting = true) => {
  const entries = ids.map((id) => ({
    isIntersecting,
    target: container.querySelector(`[data-seen-id="${id}"]`),
  }));
  act(() => observer().callback(entries, observer()));
};

const tick = () => act(() => vi.advanceTimersByTime(2000));

beforeEach(() => {
  vi.useFakeTimers();
  IO.instances.length = 0;
  markSeen.mockReset().mockResolvedValue(0);
  useNotificationsStore.setState({ markSeen });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSeenTracker', () => {
  it('watches every tracked row at half visibility', () => {
    const { container } = render(<Rows ids={[1, 2]} />);

    expect(observer().options).toEqual({ threshold: 0.5 });
    expect(observer().observed.size).toBe(2);
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('sends only the rows that came into view, in one batch', () => {
    const { container } = render(<Rows ids={[1, 2, 3]} />);

    show(container, [1, 2]);
    show(container, [3], false);
    expect(markSeen).not.toHaveBeenCalled();

    tick();
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(markSeen).toHaveBeenCalledWith([1, 2]);
  });

  it('stops watching a row once it has been seen and never sends it twice', () => {
    const { container } = render(<Rows ids={[1]} />);

    show(container, [1]);
    expect(observer().observed.size).toBe(0);
    tick();
    show(container, [1]);
    tick();

    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while nothing new came into view', () => {
    render(<Rows ids={[1]} />);

    tick();
    tick();

    expect(markSeen).not.toHaveBeenCalled();
  });

  it('sends what is left the moment the panel unmounts', () => {
    const { container, unmount } = render(<Rows ids={[1]} />);
    show(container, [1]);

    unmount();

    expect(markSeen).toHaveBeenCalledWith([1]);
  });

  it('offers the ids again after a failed send', async () => {
    markSeen.mockRejectedValueOnce(new Error('offline'));
    const { container } = render(<Rows ids={[1]} />);
    show(container, [1]);

    tick();
    await act(() => Promise.resolve());
    tick();

    expect(markSeen).toHaveBeenCalledTimes(2);
    expect(markSeen).toHaveBeenLastCalledWith([1]);
  });

  it('splits a long batch at the backend limit of 1000 ids', () => {
    render(<Rows ids={[1]} />);
    // A thousand rendered rows would only slow the test down: the observer
    // reads nothing from a row but its data-seen-id.
    const entries = Array.from({ length: 1001 }, (_, i) => ({
      isIntersecting: true,
      target: { dataset: { seenId: String(i + 1) } },
    }));
    act(() => observer().callback(entries, observer()));

    tick();

    expect(markSeen).toHaveBeenCalledTimes(2);
    expect(markSeen.mock.calls[0][0]).toHaveLength(1000);
    expect(markSeen.mock.calls[1][0]).toEqual([1001]);
  });
});
