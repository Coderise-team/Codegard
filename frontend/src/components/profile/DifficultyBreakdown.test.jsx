import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const { useDifficultyBreakdown } = vi.hoisted(() => ({
  useDifficultyBreakdown: vi.fn(),
}));
vi.mock('../../hooks/useDifficultyBreakdown', () => ({
  useDifficultyBreakdown,
}));

import DifficultyBreakdown from './DifficultyBreakdown';

const rowText = (container, key) =>
  container.querySelector(`.diff-${key} .cnt`).textContent;

beforeEach(() => {
  useDifficultyBreakdown.mockReset();
});

describe('DifficultyBreakdown', () => {
  it('renders the solved-over-total percentage per difficulty', () => {
    useDifficultyBreakdown.mockReturnValue({
      data: {
        easy: { solved: 5, total: 10 },
        medium: { solved: 1, total: 3 },
        hard: { solved: 0, total: 4 },
      },
    });

    const { container } = render(<DifficultyBreakdown username="alice" />);

    expect(rowText(container, 'easy')).toContain('50%');
    expect(rowText(container, 'medium')).toContain('33%'); // rounded
    expect(container.querySelector('.diff-total .n').textContent).toBe('6');
  });

  it('shows 0% instead of dividing by zero when a difficulty has no problems', () => {
    useDifficultyBreakdown.mockReturnValue({
      data: { easy: { solved: 0, total: 0 } },
    });

    const { container } = render(<DifficultyBreakdown username="alice" />);

    const easy = rowText(container, 'easy');
    expect(easy).toContain('0%');
    expect(easy).not.toContain('NaN');
  });

  it('falls back to zeros before the data loads', () => {
    useDifficultyBreakdown.mockReturnValue({ data: null });

    const { container } = render(<DifficultyBreakdown username="alice" />);

    expect(container.querySelector('.diff-total .n').textContent).toBe('0');
    expect(rowText(container, 'hard')).toContain('0%');
  });
});
