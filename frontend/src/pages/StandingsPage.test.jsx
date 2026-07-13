import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The page owns the query mapping (sort column -> ?ordering, tier -> ?tier),
// the podium grouping by PLACE, and the rule that hides the podium when the
// order is reversed. Stub the data layer and assert on those.
const { useStandings } = vi.hoisted(() => ({ useStandings: vi.fn() }));
vi.mock('../hooks/useStandings', () => ({ useStandings }));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ username: 'me', initials: 'ME' }),
}));

import StandingsPage from './StandingsPage';

const coder = (username, globalRank, over = {}) => ({
  username,
  globalRank,
  elo_rating: 2000 - globalRank * 10,
  maxRating: 2100,
  delta: 5,
  ...over,
});

const result = (items) => ({
  items,
  count: items.length,
  total: 400,
  you: null,
  hasMore: false,
  loading: false,
  error: null,
  loadMore: vi.fn(),
});

const lastParams = () => useStandings.mock.lastCall[0];
const renderPage = () =>
  render(
    <MemoryRouter>
      <StandingsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  useStandings.mockReset();
  // Below the podium, so the column headers render and no tile gets in the way.
  useStandings.mockReturnValue(result([coder('ann', 4)]));
});

describe('StandingsPage query', () => {
  it('asks for the best coders first and no tier filter by default', () => {
    renderPage();
    expect(lastParams()).toEqual({ ordering: '-elo_rating' });
  });

  it('flips the ordering when the same column is clicked again', () => {
    renderPage();

    fireEvent.click(screen.getByText('Rating'));
    expect(lastParams()).toEqual({ ordering: 'elo_rating' });
  });

  it('starts a newly picked column descending', () => {
    renderPage();

    fireEvent.click(screen.getByText('Max'));
    expect(lastParams()).toEqual({ ordering: '-max_rating' });
  });

  it('sends the tier only once one is picked', () => {
    renderPage();

    fireEvent.click(screen.getByText('Filter by tier'));
    fireEvent.click(screen.getByText('Expert'));
    expect(lastParams()).toEqual({ ordering: '-elo_rating', tier: 'Expert' });
  });
});

describe('StandingsPage podium', () => {
  // Two coders tie for 1st, so there is no 2nd place at all; the next one down
  // is 2nd by dense ranking.
  const tied = [
    coder('ann', 1),
    coder('bob', 1),
    coder('cid', 2),
    coder('dan', 3),
    coder('eve', 4),
  ];

  it('builds one tile per place and folds a tie into a single tile', () => {
    useStandings.mockReturnValue(result(tied));
    const { container } = renderPage();

    // Three places (1, 2, 3) -> three tiles, even though four coders hold them.
    expect(container.querySelectorAll('.pod')).toHaveLength(3);
    // The tie shares one tile, which revolves between the two of them.
    expect(container.querySelectorAll('.pod-rev')).toHaveLength(1);
  });

  it('keeps the podium coders out of the list below it', () => {
    useStandings.mockReturnValue(result(tied));
    const { container } = renderPage();

    const listed = [...container.querySelectorAll('.st-list .nm')].map(
      (el) => el.textContent
    );
    expect(listed).toEqual(['eve']); // only place 4 and below
  });

  it('hides the podium when the order is reversed and lists everyone', () => {
    useStandings.mockReturnValue(result(tied));
    const { container } = renderPage();

    fireEvent.click(screen.getByText('Rating')); // desc -> asc

    // Ascending drags the top places to the far end of the list, so a podium
    // would sit empty; the top places go back into the list instead.
    expect(container.querySelectorAll('.pod')).toHaveLength(0);
    expect(container.querySelectorAll('.st-list .st-row')).toHaveLength(5);
  });
});

describe('StandingsPage when data is missing', () => {
  it('says the leaderboard failed instead of claiming there are no coders', () => {
    useStandings.mockReturnValue({
      ...result([]),
      error: new Error('boom'),
      count: null,
      total: null,
    });
    renderPage();

    expect(screen.getByText('Standings unavailable')).toBeTruthy();
    expect(screen.queryByText('No coders found')).toBeNull();
  });

  it('hides the counts it does not know yet rather than showing a zero', () => {
    useStandings.mockReturnValue({
      ...result([]),
      count: null,
      total: null,
      loading: true,
    });
    const { container } = renderPage();

    expect(container.querySelector('.st-head .sub')).toBeNull();
    expect(container.querySelector('.st-count')).toBeNull();
  });

  it('drops the your-standing bar when the api sends no row for you', () => {
    useStandings.mockReturnValue({ ...result([coder('ann', 1)]), you: null });
    const { container } = renderPage();

    expect(container.querySelector('.st-youbar')).toBeNull();
  });
});
