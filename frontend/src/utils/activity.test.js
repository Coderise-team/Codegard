import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { buildHeatmap } from './activity';

// Midday UTC stays the same calendar day in every realistic timezone.
const NOW = new Date('2026-07-07T12:00:00Z');

// mirrors activity.js isoDate (local date parts)
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const midnightToday = () => {
  const t = new Date(NOW);
  t.setHours(0, 0, 0, 0);
  return t;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('buildHeatmap', () => {
  it('lays out full 7-day week columns (guards the DST-drift regression)', () => {
    const { weeks } = buildHeatmap({});
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('sums total and active days only over positive counts', () => {
    const today = midnightToday();
    const threeAgo = new Date(today);
    threeAgo.setDate(threeAgo.getDate() - 3);
    const { total, days } = buildHeatmap({
      [iso(today)]: 5,
      [iso(threeAgo)]: 2,
    });
    expect(total).toBe(7);
    expect(days).toBe(2);
  });

  it('places a count on its day and ignores out-of-range keys', () => {
    const today = midnightToday();
    const { weeks, total } = buildHeatmap({ [iso(today)]: 5, '1999-01-01': 9 });
    const cell = weeks.flat().find((c) => c && c.c === 5);
    expect(cell).toBeTruthy();
    expect(total).toBe(5); // the 1999 key is before the window → not counted
  });

  it('leaves days after today empty (null)', () => {
    const flat = buildHeatmap({}).weeks.flat();
    const lastFilled = flat.reduce((acc, c, i) => (c ? i : acc), -1);
    expect(lastFilled).toBeGreaterThanOrEqual(0);
    expect(flat.slice(lastFilled + 1).every((c) => c === null)).toBe(true);
  });

  it('labels month starts', () => {
    const { months } = buildHeatmap({});
    expect(months.length).toBeGreaterThan(0);
    expect(
      months.every(
        (m) => Number.isInteger(m.i) && /^[A-Z][a-z]{2}$/.test(m.label)
      )
    ).toBe(true);
  });

  it('honors weeksBack (smaller window → fewer columns)', () => {
    const small = buildHeatmap({}, 2);
    expect(small.weeks.every((w) => w.length === 7)).toBe(true);
    expect(small.weeks.length).toBeLessThan(buildHeatmap({}, 52).weeks.length);
  });
});
