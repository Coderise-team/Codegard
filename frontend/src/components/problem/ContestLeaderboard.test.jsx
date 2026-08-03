import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ContestLeaderboard from './ContestLeaderboard';

// The standings table itself (columns, rating delta, my-row pin, dedup) is
// StandingsList, covered through ContestAside.test.jsx. Here we only assert the
// leaderboard wrapper: its header/LIVE marker, that it mounts the shared table,
// and that rows link to profiles.

const panelOf = (rows, extra = {}) => ({
  rows,
  total: rows.length,
  hasMore: false,
  loading: false,
  error: null,
  loadMore: () => {},
  ...extra,
});

const rows = [
  { rank: 1, username: 'alice', score: 300, penalty: 42, solved_count: 3 },
  { rank: 2, username: 'bob', score: 200, penalty: 60, solved_count: 2 },
];

const renderLb = (props) =>
  render(
    <MemoryRouter>
      <ContestLeaderboard
        live
        panel={panelOf(rows)}
        problemsCount={5}
        you="bob"
        myStanding={null}
        {...props}
      />
    </MemoryRouter>
  );

describe('ContestLeaderboard', () => {
  it('mounts the shared standings table with its header and rows', () => {
    const { container } = renderLb();

    expect(container.querySelector('.cpp-lb')).toBeTruthy();
    expect(container.querySelector('.cp-thead').textContent).toContain(
      'Penalty'
    );
    expect(container.querySelectorAll('.cp-row')).toHaveLength(2);
  });

  it('marks LIVE while running and links rows to profiles', () => {
    const { container } = renderLb();

    expect(container.querySelector('.cpp-lb-live')).toBeTruthy();
    const [first, own] = container.querySelectorAll('.cp-row');
    expect(first.getAttribute('href')).toBe('/users/alice');
    expect(own.classList.contains('you')).toBe(true);
    // one profile route for everyone, own row included (shareable url)
    expect(own.getAttribute('href')).toBe('/users/bob');
  });

  it('hides the LIVE marker after the round', () => {
    const { container } = renderLb({ live: false });
    expect(container.querySelector('.cpp-lb-live')).toBeNull();
  });

  it('pins my out-of-view row from my-standing under the gap', () => {
    const { container } = renderLb({
      you: 'carol',
      myStanding: { rank: 17, score: 100, solved: 1 },
    });

    expect(container.querySelector('.cp-gap')).toBeTruthy();
    const mine = container.querySelector('.cp-row.you');
    expect(mine.querySelector('.cp-rk').textContent).toBe('17');
    expect(mine.textContent).toContain('carol');
    expect(mine.getAttribute('href')).toBe('/users/carol');
  });

  it('shows loading and empty states', () => {
    const loading = renderLb({ panel: panelOf([], { loading: true }) });
    expect(loading.container.textContent).toContain('Loading…');

    const empty = renderLb({ panel: panelOf([]) });
    expect(empty.container.textContent).toContain('No submissions yet');
  });
});
