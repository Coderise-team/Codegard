import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import LiveContest from './LiveContest';

// The board re-sorts itself on a timer when motion is allowed; these tests are
// about the order it puts people in, so the timer is kept out of it.
vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

const participant = (handle, solved, pen, last, you = false) => ({
  handle,
  initials: handle.slice(0, 2).toUpperCase(),
  solved,
  pts: solved * 100,
  pen,
  last,
  you,
});

const contest = {
  name: 'Codegard Round 12',
  lengthSeconds: 3 * 3600,
  secondsLeft: 1 * 3600 + 23 * 60 + 45,
  current: 'C',
  problems: [
    { id: 'A', status: 'solved' },
    { id: 'B', status: 'attempted' },
    { id: 'C', status: 'open' },
  ],
  board: [
    // Same score as `even`, larger penalty — must come second of the two.
    participant('slower', 4, 250, '01:55'),
    participant('leader', 5, 214, '01:12'),
    participant('even', 4, 168, '01:29', true),
    // Same score and the same penalty as `tied`: the earlier finish wins.
    participant('tied', 3, 132, '01:40'),
    participant('early', 3, 132, '01:04'),
  ],
};

// Several cells in a row are plain numbers, so the place is taken from its own.
const rankOf = (handle) =>
  screen.getByText(handle).closest('.brow').querySelector('.cp-rk').textContent;

describe('LiveContest', () => {
  it('ranks by score first, then the smaller penalty, then who got there first', () => {
    render(<LiveContest contest={contest} />);

    expect(rankOf('leader')).toBe('1');
    expect(rankOf('even')).toBe('2');
    expect(rankOf('slower')).toBe('3');
    expect(rankOf('early')).toBe('4');
    expect(rankOf('tied')).toBe('5');
  });

  it('marks the visitor’s own row', () => {
    render(<LiveContest contest={contest} />);

    expect(screen.getByText('even').closest('.brow')).toHaveClass('you');
    expect(screen.getByText('leader').closest('.brow')).not.toHaveClass('you');
  });

  it('shows what is left of the round, down to the second', () => {
    render(<LiveContest contest={contest} />);

    expect(screen.getByText('01:23:45')).toBeInTheDocument();
  });

  it('carries the round’s problems with the state each one is in', () => {
    render(<LiveContest contest={contest} />);

    expect(screen.getByText('A').closest('.rc-pip')).toHaveClass('s-solved');
    expect(screen.getByText('B').closest('.rc-pip')).toHaveClass('s-attempted');
    expect(screen.getByText('C').closest('.rc-pip')).toHaveClass('current');
  });
});
