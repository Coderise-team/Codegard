import { useEffect } from 'react';

// Share of the remaining distance covered each frame. Lower glides longer.
const EASE = 0.05;
// A wheel notch can arrive in lines or in pages instead of pixels.
const LINE_PX = 16;
// Close enough to the target to stop and let the position land exactly.
const DONE_PX = 0.5;
// Notches closer together than this are one continuous push, and the page
// picks up speed: each one adds to the step, up to ACCEL_MAX times a notch.
// Without it a fast scroll covers no more ground than a slow one and the page
// feels like it is lagging behind the hand.
const ACCEL_WINDOW_MS = 60;
const ACCEL_STEP = 0.3;
const ACCEL_MAX = 2;
// However hard the wheel is spun, the page never has more than this much of a
// screen queued up ahead of where it currently is — a hard flick should carry
// you to the next section, not through it.
const MAX_AHEAD = 0.85;

/**
 * useSmoothScroll — gives the page weight: the wheel sets where the page is
 * heading, and the page slides there and coasts to a stop rather than jumping
 * the whole distance at once.
 *
 * Only the wheel is taken over. Dragging the scrollbar, the keyboard and jumps
 * to an anchor keep working on their own, and the target is picked back up
 * from wherever they left the page.
 *
 * Two things have to be right or the page crawls:
 *
 *  - every frame moves the page with `behavior: 'instant'`. The page carries
 *    `scroll-behavior: smooth` for anchor jumps, and that applies to any scroll
 *    made from code — the browser would answer each frame with an easing of its
 *    own, then abandon it a frame later, and the two would compound into a
 *    scroll that never arrives;
 *  - the position is carried in a variable of our own rather than read back
 *    from the element. The element rounds it to whole pixels, so once the
 *    remaining distance is small the step rounds to nothing and the page stops
 *    short with the frames still running.
 *
 * @param scrollEl the page's scroll area, or null before it exists
 * @param enabled  false leaves scrolling completely alone
 */
export function useSmoothScroll(scrollEl, enabled = true) {
  useEffect(() => {
    if (!scrollEl || !enabled) return undefined;

    let at = scrollEl.scrollTop; // where the page is, unrounded
    let target = at;
    let raf = 0;
    let accel = 1;
    // No notch yet, so the first one can never count as a continuation of one.
    let lastNotch = -Infinity;

    const limit = () => scrollEl.scrollHeight - scrollEl.clientHeight;
    const moveTo = (top) => scrollEl.scrollTo({ top, behavior: 'instant' });

    const frame = () => {
      const distance = target - at;
      if (Math.abs(distance) < DONE_PX) {
        raf = 0;
        at = target;
        moveTo(at);
        return;
      }
      at += distance * EASE;
      moveTo(at);
      raf = requestAnimationFrame(frame);
    };

    const onWheel = (e) => {
      if (e.ctrlKey) return; // pinch-zoom, not a scroll
      const step =
        e.deltaMode === 1
          ? e.deltaY * LINE_PX
          : e.deltaMode === 2
            ? e.deltaY * scrollEl.clientHeight
            : e.deltaY;
      e.preventDefault();

      const now = e.timeStamp;
      accel =
        now - lastNotch < ACCEL_WINDOW_MS
          ? Math.min(ACCEL_MAX, accel + ACCEL_STEP)
          : 1;
      lastNotch = now;

      const reach = scrollEl.clientHeight * MAX_AHEAD;
      const queued = Math.max(
        at - reach,
        Math.min(at + reach, target + step * accel)
      );
      target = Math.max(0, Math.min(limit(), queued));
      if (!raf) raf = requestAnimationFrame(frame);
    };

    // Anything that moved the page without the wheel becomes the new start.
    const onScroll = () => {
      if (raf) return;
      at = scrollEl.scrollTop;
      target = at;
    };

    scrollEl.addEventListener('wheel', onWheel, { passive: false });
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener('wheel', onWheel);
      scrollEl.removeEventListener('scroll', onScroll);
    };
  }, [scrollEl, enabled]);
}
