import { describe, it, expect } from 'vitest';

import { cgRankFor, CG_RANKS } from './ranks';

describe('cgRankFor', () => {
  it('maps a rating to its tier, band bounds and next tier', () => {
    const r = cgRankFor(1850); // Master band [1800, 2000)
    expect(r.name).toBe('Master');
    expect(r.color).toBe('#A78BFA');
    expect(r.floor).toBe(1800);
    expect(r.ceil).toBe(2000);
    expect(r.nextName).toBe('Grandmaster');
  });

  it('is inclusive on the lower bound and exclusive on the next tier floor', () => {
    // Exactly on a floor promotes to that tier.
    expect(cgRankFor(1200).name).toBe('Junior');
    // One below the next floor stays in the current tier.
    expect(cgRankFor(1199).name).toBe('Trainee');
    expect(cgRankFor(1199).ceil).toBe(1200);
  });

  it('handles the bottom tier from zero', () => {
    const r = cgRankFor(0);
    expect(r.name).toBe('Trainee');
    expect(r.floor).toBe(0);
    expect(r.ceil).toBe(1200);
    expect(r.nextName).toBe('Junior');
  });

  it('caps at the top tier with a synthetic ceil and no further tier', () => {
    const top = CG_RANKS[CG_RANKS.length - 1]; // Kernel, min 2400
    const r = cgRankFor(9999);
    expect(r.name).toBe(top.name);
    expect(r.floor).toBe(top.min);
    expect(r.ceil).toBe(top.min + 400);
    expect(r.nextName).toBe(top.name);
  });
});
