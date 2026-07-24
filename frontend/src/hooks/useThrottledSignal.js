import { useEffect, useRef, useState } from 'react';

const BASE_MS = 1500;
const JITTER_MS = 2000;

/**
 * Paces a raw signal counter (e.g. from useLeaderboardSignal) into refetches
 * that happen at most once per window. During a hot streak the socket can bump
 * the raw signal many times a second; this coalesces those into a single paced
 * bump, delayed by `base` plus a random slice up to `jitter`.
 *
 * The delay is deliberate, not laziness:
 *  - throttle (the fixed `base` floor): the standings refresh calmly instead of
 *    thrashing on every submission;
 *  - jitter (the random part): each client waits a slightly different amount, so
 *    a room full of viewers does not all refetch in the very same instant — and
 *    that spread is what lets the server-side page cache actually take (the
 *    first request fills it, the rest read it).
 *
 * Trailing + coalescing: the first raw bump arms a timer; further bumps while it
 * is armed are absorbed and do NOT push the timer back, so a continuous stream
 * still fires on schedule (a debounce would starve). When it fires, the consumer
 * refetches the current page, which already reflects everything up to that
 * moment — so a coalesced bump never loses an update.
 */
export function useThrottledSignal(
  raw,
  { base = BASE_MS, jitter = JITTER_MS } = {}
) {
  const [paced, setPaced] = useState(0);
  const armedRef = useRef(false);
  const timerRef = useRef(null);
  const prevRawRef = useRef(raw);

  useEffect(() => {
    if (raw === prevRawRef.current) return; // initial mount / no real change
    prevRawRef.current = raw;
    if (armedRef.current) return; // coalesce into the already-pending fire

    armedRef.current = true;
    timerRef.current = setTimeout(
      () => {
        armedRef.current = false;
        setPaced((n) => n + 1);
      },
      base + Math.random() * jitter
    );
  }, [raw, base, jitter]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return paced;
}
