import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The stub from src/test/setup.js; the page observes whichever node holds you.
const IO = globalThis.IntersectionObserver;

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
  IO.instances.length = 0;
  // Below the podium, so the column headers render and no tile gets in the way.
  useStandings.mockReturnValue(result([coder('ann', 4)]));
});

describe('StandingsPage query', () => {
  it('sends nothing at all by default and lets the server decide', () => {
    renderPage();
    expect(lastParams()).toEqual({});
  });

  it('cycles a column through descending, ascending and back to default', () => {
    renderPage();
    const rating = () => screen.getByText('Rating');

    fireEvent.click(rating()); // best first
    expect(lastParams()).toEqual({ ordering: '-elo_rating' });

    fireEvent.click(rating()); // reversed
    expect(lastParams()).toEqual({ ordering: 'elo_rating' });

    fireEvent.click(rating()); // off — the server's default order again
    expect(lastParams()).toEqual({});
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
    expect(lastParams()).toEqual({ tier: 'Expert' });
  });

  it('leads with the peak rating once the table is sorted by it', () => {
    useStandings.mockReturnValue(result([coder('ann', 4)]));
    const { container } = renderPage();

    expect(container.querySelector('.st-row.by-max')).toBeNull();

    fireEvent.click(screen.getByText('Max'));
    expect(container.querySelector('.st-row.by-max')).toBeTruthy();
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

    fireEvent.click(screen.getByText('Rating')); // default -> desc
    fireEvent.click(screen.getByText('Rating')); // desc -> asc

    // Ascending drags the top places to the far end of the list, so a podium
    // would sit empty; the top places go back into the list instead.
    expect(container.querySelectorAll('.pod')).toHaveLength(0);
    expect(container.querySelectorAll('.st-list .st-row')).toHaveLength(5);
  });

  it('hides the floating bar once your own podium tile is on screen', () => {
    // 'me' shares 1st place, so there is no row of mine in the list at all —
    // the tracker has to ride the tile, or the bar would never let go.
    useStandings.mockReturnValue({
      ...result([coder('ann', 1), coder('me', 1), coder('cid', 2)]),
      you: coder('me', 1),
    });
    const { container } = renderPage();

    expect(container.querySelector('.st-youbar')).toBeTruthy();

    const observer = IO.instances[IO.instances.length - 1];
    expect([...observer.observed][0].className).toContain('pod');

    act(() => observer.emit(true)); // your tile scrolled into view
    expect(container.querySelector('.st-youbar')).toBeNull();
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
