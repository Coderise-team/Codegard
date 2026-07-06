// Codegard rank ladder.
//
// Names and thresholds MUST mirror the backend RANK_THRESHOLDS
// (apps/users/services.py) — the backend is the source of truth for which
// rank a rating maps to. Colors are a frontend-only presentation choice
// (semantic tier tint, independent of the violet accent) with no backend
// counterpart.
export const CG_RANKS = [
  { name: 'Trainee', min: 0, color: '#7E8796' },
  { name: 'Junior', min: 1200, color: '#22C55E' },
  { name: 'Specialist', min: 1400, color: '#2DD4BF' },
  { name: 'Expert', min: 1600, color: '#38BDF8' },
  { name: 'Master', min: 1800, color: '#A78BFA' },
  { name: 'Grandmaster', min: 2000, color: '#F472B6' },
  { name: 'Architect', min: 2200, color: '#FB923C' },
  { name: 'Kernel', min: 2400, color: '#F87171' },
];

/**
 * Rank info for a rating: the tier (name, color, min) plus its band bounds
 * (floor/ceil) and the next tier's name. At the top tier ceil is synthetic
 * (min + 400) and nextName repeats the current name.
 */
export function cgRankFor(rating) {
  let tier = CG_RANKS[0],
    next = null;
  for (let i = 0; i < CG_RANKS.length; i++) {
    if (rating >= CG_RANKS[i].min) {
      tier = CG_RANKS[i];
      next = CG_RANKS[i + 1] || null;
    }
  }
  const floor = tier.min;
  const ceil = next ? next.min : tier.min + 400;
  return { ...tier, floor, ceil, nextName: next ? next.name : tier.name };
}
