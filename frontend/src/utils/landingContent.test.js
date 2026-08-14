import { describe, it, expect } from 'vitest';

import landingContent from './landingContent';
import { CG_RANKS, cgRankFor } from './ranks';

// The landing has no backend behind it, so nothing stops a sample row from
// drifting away from the rules the product actually runs on. These check the
// claims the page makes out loud.
describe('landing content', () => {
  it('scores the contest board the way a round is scored', () => {
    landingContent.contest.board.forEach((row) => {
      expect(row.pts).toBe(row.solved * 100);
    });
  });

  it('takes every tier from the shared ladder', () => {
    [...landingContent.podium, ...landingContent.table].forEach((coder) => {
      const tier = cgRankFor(coder.rating);
      expect(coder.tier).toBe(tier.name);
      expect(coder.color).toBe(tier.color);
    });
    expect(landingContent.ladder).toBe(CG_RANKS);
  });

  it('keeps the podium in place order, first place first', () => {
    expect(landingContent.podium.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it('tells the same story about the visitor everywhere', () => {
    const { you } = landingContent;
    const row = landingContent.table.find((coder) => coder.you);

    expect(row.handle).toBe(you.handle);
    expect(row.rating).toBe(you.rating);
    expect(row.delta).toBe(you.delta);
    expect(row.max).toBe(you.max);
    expect(row.rank).toBe(you.rank);
  });

  it('ends the rating history on the rating shown, one round back', () => {
    const { history, rating, delta, max } = landingContent.you;
    expect(history.at(-1)).toBe(rating);
    expect(history.at(-1) - history.at(-2)).toBe(delta);
    expect(Math.max(...history)).toBe(max);
  });

  it('sorts the catalogue by the share of attempts that pass', () => {
    const rates = landingContent.solo.catalogue.map((p) => p.acceptance);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
  });

  it('leaves the whole rating table above the visitor', () => {
    const ranks = landingContent.table.map((coder) => coder.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});
