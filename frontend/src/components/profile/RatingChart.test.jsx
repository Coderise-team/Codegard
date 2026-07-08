import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import RatingChart from './RatingChart';

const meta = (container) => {
  const out = {};
  container.querySelectorAll('.cmeta .m').forEach((m) => {
    out[m.querySelector('.k').textContent] = m.querySelector('.v').textContent;
  });
  return out;
};

const point = (rating, day) => ({
  rating,
  created_at: `2026-06-0${day}T12:00:00Z`,
});

describe('RatingChart', () => {
  it('shows a placeholder with fewer than two points', () => {
    const { rerender } = render(<RatingChart user={{}} history={null} />);
    expect(
      screen.getByText('Not enough rated contests yet.')
    ).toBeInTheDocument();

    rerender(<RatingChart user={{}} history={[point(1500, 1)]} />);
    expect(
      screen.getByText('Not enough rated contests yet.')
    ).toBeInTheDocument();
  });

  it('draws the chart and reports current/peak/contests', () => {
    const user = { elo_rating: 1600, maxRating: 1720 };
    const history = [point(1500, 1), point(1650, 2), point(1600, 3)];

    const { container } = render(<RatingChart user={user} history={history} />);

    const m = meta(container);
    expect(m.Current).toBe('1600');
    expect(m.Peak).toBe('1720'); // maxRating wins over the in-window max
    expect(m.Contests).toBe('3'); // = history.length
    expect(container.querySelector('svg path.line')).toBeTruthy();
  });

  it('falls back to the in-window peak when maxRating is absent', () => {
    const history = [point(1500, 1), point(1650, 2)];
    const { container } = render(
      <RatingChart user={{ elo_rating: 1650 }} history={history} />
    );
    expect(meta(container).Peak).toBe('1650');
  });
});
