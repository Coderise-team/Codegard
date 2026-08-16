import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSmoothScroll } from './useSmoothScroll';

// A stand-in for the page's scroll area: jsdom lays nothing out, so the sizes
// it would measure are given here, and moving it reports itself the way a real
// element does — the hook watches those reports to tell its own movement from
// everybody else's.
function makeScroller({ view = 800, content = 4000 } = {}) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: view });
  Object.defineProperty(el, 'scrollHeight', { value: content });
  el.scrollTo = ({ top }) => moveTo(el, top);
  return el;
}

const moveTo = (el, top) => {
  el.scrollTop = top;
  el.dispatchEvent(new Event('scroll'));
};

const wheel = (el, deltaY, timeStamp = 0) => {
  const event = new Event('wheel', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'deltaY', { value: deltaY });
  Object.defineProperty(event, 'deltaMode', { value: 0 });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  el.dispatchEvent(event);
  return event;
};

// Runs the animation to its end: every frame moves a share of what is left.
const settle = (frames = 200) => {
  for (let i = 0; i < frames; i++) vi.advanceTimersToNextFrame();
};

describe('useSmoothScroll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('carries the page the distance the wheel asked for', () => {
    const el = makeScroller();
    renderHook(() => useSmoothScroll(el));

    wheel(el, 300);
    settle();

    expect(el.scrollTop).toBe(300);
  });

  it('gets there gradually rather than in one jump', () => {
    const el = makeScroller();
    renderHook(() => useSmoothScroll(el));

    wheel(el, 300);
    vi.advanceTimersToNextFrame();

    expect(el.scrollTop).toBeGreaterThan(0);
    expect(el.scrollTop).toBeLessThan(300);
  });

  it('picks up speed when the notches keep coming', () => {
    const steady = makeScroller();
    renderHook(() => useSmoothScroll(steady));
    wheel(steady, 100, 0);
    wheel(steady, 100, 500);
    settle();

    const fast = makeScroller();
    renderHook(() => useSmoothScroll(fast));
    wheel(fast, 100, 0);
    wheel(fast, 100, 20);
    settle();

    expect(steady.scrollTop).toBe(200);
    expect(fast.scrollTop).toBeGreaterThan(steady.scrollTop);
  });

  it('never queues more than a screen ahead, however hard it is spun', () => {
    const el = makeScroller({ view: 800 });
    renderHook(() => useSmoothScroll(el));

    for (let i = 0; i < 20; i++) wheel(el, 400, i * 10);
    settle();

    expect(el.scrollTop).toBeLessThanOrEqual(800 * 0.85);
  });

  it('stops at the end of the page', () => {
    const el = makeScroller({ view: 800, content: 1200 });
    renderHook(() => useSmoothScroll(el));

    wheel(el, 5000);
    settle();

    expect(el.scrollTop).toBe(400);
  });

  it('gives way to a move made by anything other than the wheel', () => {
    const el = makeScroller();
    renderHook(() => useSmoothScroll(el));

    wheel(el, 600);
    vi.advanceTimersToNextFrame(); // the glide is under way

    moveTo(el, 2000); // a link to a section, the scrollbar, the keyboard
    settle();

    expect(el.scrollTop).toBe(2000);
  });

  it('takes the wheel back when it is switched off', () => {
    const el = makeScroller();
    renderHook(() => useSmoothScroll(el, false));

    const event = wheel(el, 300);
    settle();

    expect(event.defaultPrevented).toBe(false);
    expect(el.scrollTop).toBe(0);
  });
});
