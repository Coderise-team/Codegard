import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import ContestRow from './ContestRow';

// A pending contest ~2h out, evaluated against a fixed `now`.
const NOW = 1_000_000_000_000;
const contest = {
  id: 7,
  title: 'Codegard Cup #40',
  start_time: new Date(NOW + 2 * 3600 * 1000).toISOString(),
  end_time: new Date(NOW + 4 * 3600 * 1000).toISOString(),
  problems_count: 5,
  participants_count: 1234,
};

const renderRow = (props) =>
  render(
    <ContestRow
      c={contest}
      now={NOW}
      registered={false}
      onToggle={() => {}}
      onOpen={() => {}}
      {...props}
    />
  );

describe('ContestRow', () => {
  it('renders the Register pill when not registered', () => {
    const { container } = renderRow({ registered: false });
    expect(container.querySelector('.reg-pill.go')).toBeTruthy();
    expect(container.querySelector('.reg-pill.done')).toBeNull();
  });

  it('renders the Registered pill when registered', () => {
    const { container } = renderRow({ registered: true });
    expect(container.querySelector('.reg-pill.done')).toBeTruthy();
    expect(container.querySelector('.reg-pill.go')).toBeNull();
  });

  it('shows the "starts in" countdown derived from the now prop', () => {
    const { container } = renderRow();
    // 2h ahead of `now`
    expect(container.querySelector('.cr-count .v').textContent).toBe('02:00:00');
  });

  it('highlights the nearest contest with the is-soon class', () => {
    const { container } = renderRow({ soon: true });
    expect(container.querySelector('.ct-row.is-soon')).toBeTruthy();
  });

  it('opens the contest on a card click', () => {
    const onOpen = vi.fn();
    const { container } = renderRow({ onOpen });

    fireEvent.click(container.querySelector('.ct-row'));

    expect(onOpen).toHaveBeenCalledWith(contest);
  });

  it('registers without opening the contest (stops propagation)', () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    const { container } = renderRow({ onOpen, onToggle });

    fireEvent.click(container.querySelector('.reg-pill'));

    expect(onToggle).toHaveBeenCalledWith(contest);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
