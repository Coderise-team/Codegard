import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ContestRail from './ContestRail';

const rows = [
  { rank: 1, username: 'alice', score: 3, penalty: 42 },
  { rank: 2, username: 'bob', score: 2, penalty: 60 },
];

const renderRail = (props) =>
  render(
    <MemoryRouter>
      <ContestRail
        contestId={5}
        live
        panel={{ rows, loading: false, error: null }}
        you="bob"
        myStanding={null}
        {...props}
      />
    </MemoryRouter>
  );

describe('ContestRail', () => {
  it('renders the rows, highlights the own row and marks the podium', () => {
    const { container } = renderRail();

    expect(container.querySelectorAll('.cpp-rail-row')).toHaveLength(2);
    const own = container.querySelector('.cpp-rail-row.you');
    expect(own.textContent).toContain('bob');
    expect(container.querySelector('.cpp-rail-row.top .rk').textContent).toBe(
      '1'
    );
    expect(container.querySelector('.cpp-rail-live')).toBeTruthy();
    expect(container.querySelector('.cpp-rail-all').getAttribute('href')).toBe(
      '/contests/5'
    );
  });

  it('pins the own row when it is off the visible slice', () => {
    const { container } = renderRail({
      you: 'carol',
      myStanding: { rank: 17, score: 1, solved: 1 },
    });

    expect(container.querySelector('.cpp-rail-gap')).toBeTruthy();
    const pinned = container.querySelector('.cpp-rail-row.you');
    expect(pinned.textContent).toContain('17');
    expect(pinned.textContent).toContain('carol');
  });

  it('does not pin when the own row is already shown', () => {
    const { container } = renderRail({
      you: 'alice',
      myStanding: { rank: 1, score: 3, solved: 3 },
    });

    expect(container.querySelector('.cpp-rail-gap')).toBeNull();
  });

  it('hides the LIVE marker after the round', () => {
    const { container } = renderRail({ live: false });
    expect(container.querySelector('.cpp-rail-live')).toBeNull();
  });

  it('shows loading and empty states', () => {
    const loadingView = renderRail({
      panel: { rows: [], loading: true, error: null },
    });
    expect(loadingView.container.textContent).toContain('Loading');

    const emptyView = renderRail({
      panel: { rows: [], loading: false, error: null },
    });
    expect(emptyView.container.textContent).toContain('No submissions yet');
  });
});
