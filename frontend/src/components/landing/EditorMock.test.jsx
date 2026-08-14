import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import EditorMock from './EditorMock';
import { DEMO_CODE } from '../../utils/landingContent';

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => motion.reduced,
}));

// Delays the component works to, named here so a test reads as the sequence
// rather than as arithmetic.
const START = 500;
const PRESS = 520;
const RUNNING = 240;
const VERDICT = 1340;
const RESTART = 6900;

// Typing adds one or two characters a tick, at random. Held to one below, so
// the run takes exactly a tick per character and each step of the cycle can be
// stepped into on its own rather than overshot.
const TYPING = 26 * DEMO_CODE.length;

const run = (ms) => act(() => vi.advanceTimersByTime(ms));

const codeShown = () => document.querySelector('.ed-code').textContent;
const submitButton = () => document.querySelector('.ed-actions .btn-primary');

describe('EditorMock', () => {
  beforeEach(() => {
    motion.reduced = false;
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('holds still for a moment, then types the solution out', () => {
    render(<EditorMock />);
    expect(codeShown()).toBe('');

    run(START + TYPING);

    expect(codeShown()).toBe(DEMO_CODE);
  });

  it('walks from the press through the judging to the verdict', () => {
    render(<EditorMock />);
    run(START + TYPING);

    // typed, waiting to be sent
    expect(submitButton()).not.toHaveClass('pressed');
    expect(screen.getByText('Python 3 · ready')).toBeInTheDocument();

    run(PRESS);
    expect(submitButton()).toHaveClass('pressed');

    run(RUNNING);
    expect(screen.getByText('Judging…')).toBeInTheDocument();
    expect(screen.queryByText('Accepted')).not.toBeInTheDocument();

    run(VERDICT);
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('38 ms')).toBeInTheDocument();
  });

  it('clears the verdict and starts over after a pause', () => {
    render(<EditorMock />);
    run(START + TYPING + PRESS + RUNNING + VERDICT);
    expect(screen.getByText('Accepted')).toBeInTheDocument();

    run(RESTART);

    expect(codeShown()).toBe('');
    expect(screen.queryByText('Accepted')).not.toBeInTheDocument();
  });

  it('leaves no timer behind when it goes away', () => {
    const { unmount } = render(<EditorMock />);
    run(START + 26 * 5); // caught mid-typing, with an interval running

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the finished frame and runs nothing when motion is not wanted', () => {
    motion.reduced = true;
    render(<EditorMock />);

    expect(codeShown()).toBe(DEMO_CODE);
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(document.querySelector('.ed-caret')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
