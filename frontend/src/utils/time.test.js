import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  timeAgo,
  formatDate,
  formatFullDate,
  formatTimeOfDay,
  secondsUntil,
  fmtCountdown,
  formatDuration,
} from './time';

// Fixed "now" so relative helpers are deterministic. Midday UTC stays the same
// calendar day in every realistic timezone, keeping date assertions stable.
const NOW = '2026-07-07T12:00:00Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('timeAgo', () => {
  it('says "just now" under a minute', () => {
    expect(timeAgo('2026-07-07T11:59:30Z')).toBe('just now');
  });

  it('counts minutes and hours', () => {
    expect(timeAgo('2026-07-07T11:55:00Z')).toBe('5m ago');
    expect(timeAgo('2026-07-07T09:00:00Z')).toBe('3h ago');
  });

  it('says "Yesterday" at one day and counts days under a week', () => {
    expect(timeAgo('2026-07-06T12:00:00Z')).toBe('Yesterday');
    expect(timeAgo('2026-07-04T12:00:00Z')).toBe('3d ago');
  });

  it('follows an explicit now instead of the wall clock', () => {
    const nowMs = new Date('2026-07-07T15:00:00Z').getTime();
    expect(timeAgo('2026-07-07T12:00:00Z', nowMs)).toBe('3h ago');
  });

  it('falls back to an absolute date at a week or older', () => {
    // 10 days ago → no "Nd ago", a "Mon D" date instead.
    expect(timeAgo('2026-06-27T12:00:00Z')).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});

describe('formatDate', () => {
  it('formats a short month + day', () => {
    expect(formatDate('2026-05-28T12:00:00Z')).toBe('May 28');
  });
});

describe('formatFullDate', () => {
  it('formats a short month + day + year', () => {
    // Timezone-less ISO → parsed as local time, so the calendar day is stable
    // in every timezone.
    expect(formatFullDate('2026-06-06T17:00:00')).toBe('Jun 6, 2026');
  });
});

describe('formatTimeOfDay', () => {
  it('formats a 24h clock time', () => {
    expect(formatTimeOfDay('2026-06-06T17:00:00')).toBe('17:00');
  });

  it('keeps midnight as 00', () => {
    expect(formatTimeOfDay('2026-06-06T00:05:00')).toBe('00:05');
  });
});

describe('secondsUntil', () => {
  it('counts seconds to a future instant', () => {
    expect(secondsUntil('2026-07-07T12:01:30Z')).toBe(90);
  });

  it('never goes negative for a past instant', () => {
    expect(secondsUntil('2026-07-07T11:00:00Z')).toBe(0);
  });
});

describe('fmtCountdown', () => {
  it('zero-pads hours:minutes:seconds', () => {
    expect(fmtCountdown(0)).toBe('00:00:00');
    expect(fmtCountdown(281)).toBe('00:04:41');
  });

  it('prefixes whole days', () => {
    // 1d 2h 5m 9s
    expect(fmtCountdown(86400 + 7200 + 300 + 9)).toBe('1d 02:05:09');
  });

  it('clamps a negative total to zero', () => {
    expect(fmtCountdown(-5)).toBe('00:00:00');
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes, dropping the empty part', () => {
    expect(formatDuration('2026-07-07T10:00:00Z', '2026-07-07T12:00:00Z')).toBe(
      '2h'
    );
    expect(formatDuration('2026-07-07T10:00:00Z', '2026-07-07T11:30:00Z')).toBe(
      '1h 30m'
    );
    expect(formatDuration('2026-07-07T10:00:00Z', '2026-07-07T10:45:00Z')).toBe(
      '45m'
    );
  });
});
