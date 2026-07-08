import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

import { useInfiniteScroll } from './useInfiniteScroll';

// The stub from src/test/setup.js records every observer it constructs and lets
// a test fire its callback. Grab the most recent one.
const IO = globalThis.IntersectionObserver;
const lastObserver = () => IO.instances[IO.instances.length - 1];

// Mounts the hook against a real sentinel node so the effect's ref.current is set.
function Sentinel({ onLoadMore, enabled }) {
  const ref = useInfiniteScroll(onLoadMore, enabled);
  return <div ref={ref} data-testid="sentinel" />;
}

beforeEach(() => {
  IO.instances.length = 0;
});

describe('useInfiniteScroll', () => {
  it('calls onLoadMore only when the sentinel intersects', () => {
    const onLoadMore = vi.fn();
    render(<Sentinel onLoadMore={onLoadMore} enabled />);

    lastObserver().emit(false);
    expect(onLoadMore).not.toHaveBeenCalled();

    lastObserver().emit(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not observe while disabled', () => {
    const onLoadMore = vi.fn();
    render(<Sentinel onLoadMore={onLoadMore} enabled={false} />);

    expect(IO.instances).toHaveLength(0);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<Sentinel onLoadMore={vi.fn()} enabled />);
    const observer = lastObserver();
    expect(observer.observed.size).toBe(1);

    unmount();
    expect(observer.observed.size).toBe(0);
  });
});
