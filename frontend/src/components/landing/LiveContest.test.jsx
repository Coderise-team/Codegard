import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import LiveContest from './LiveContest';

const motion = vi.hoisted(() => ({ reduced: true }));
vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => motion.reduced,
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
  // The board solves a problem for somebody every few seconds when motion is
  // allowed. These are about the order it puts people in, so it is held still.
  beforeEach(() => {
    motion.reduced = true;
  });

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

  describe('while it is running', () => {
    // One person short of finishing and everyone else already done, so the
    // board has exactly one move to make and it needs no luck to find it.
    const running = {
      ...contest,
      board: [
        { ...participant('climber', 4, 200, '01:10'), solved: 4 },
        participant('done', 5, 100, '00:50'),
      ],
    };

    const cellsOf = (handle) =>
      Array.from(
        screen.getByText(handle).closest('.brow').querySelectorAll('.cp-cell')
      ).map((cell) => cell.textContent);

    beforeEach(() => {
      motion.reduced = false;
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('hands somebody a problem, worth a whole hundred points', () => {
      render(<LiveContest contest={running} />);
      expect(cellsOf('climber').slice(0, 2)).toEqual(['4/5', '400']);

      act(() => vi.advanceTimersByTime(3400));

      expect(cellsOf('climber').slice(0, 2)).toEqual(['5/5', '500']);
    });

    it('lights the row that just moved, then lets it settle', () => {
      render(<LiveContest contest={running} />);
      act(() => vi.advanceTimersByTime(3400));

      expect(screen.getByText('climber').closest('.brow')).toHaveClass('bump');

      act(() => vi.advanceTimersByTime(1400));

      expect(screen.getByText('climber').closest('.brow')).not.toHaveClass(
        'bump'
      );
    });

    it('has nothing left to do once everyone has finished', () => {
      render(<LiveContest contest={running} />);
      act(() => vi.advanceTimersByTime(3400 * 6));

      expect(cellsOf('climber').slice(0, 2)).toEqual(['5/5', '500']);
      expect(cellsOf('done').slice(0, 2)).toEqual(['5/5', '500']);
    });

    it('runs the clock down', () => {
      render(<LiveContest contest={running} />);
      expect(screen.getByText('01:23:45')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(5000));

      expect(screen.getByText('01:23:40')).toBeInTheDocument();
    });
  });
});
