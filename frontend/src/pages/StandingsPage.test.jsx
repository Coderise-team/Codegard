import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The stub from src/test/setup.js; the page observes whichever node holds you.
const IO = globalThis.IntersectionObserver;

// The page owns the query mapping (sort column -> ?ordering, tier -> ?tier),
// the podium grouping by PLACE, and the rule that hides the podium when the
// order is reversed. Stub the data layer and assert on those.
const { useStandings, navigate } = vi.hoisted(() => ({
  useStandings: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('../hooks/useStandings', () => ({ useStandings }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));
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
  navigate.mockReset();
  IO.instances.length = 0;
  // Below the podium, so the column headers render and no tile gets in the way.
  useStandings.mockReturnValue(result([coder('ann', 4)]));
});

describe('StandingsPage query', () => {
  it('asks for the best coders first, and says so in the header', () => {
    const { container } = renderPage();

    // The ordering is always explicit — we never lean on the server's default.
    expect(lastParams()).toEqual({ ordering: '-elo_rating' });
    // A board is always sorted by something, so the column is lit from the off.
    expect(container.querySelector('.sth-rating.active')).toBeTruthy();
  });

  it('cycles a column through descending, ascending and back to the default', () => {
    renderPage();
    const max = () => screen.getByText('Max');

    fireEvent.click(max()); // best peak first
    expect(lastParams()).toEqual({ ordering: '-max_rating' });

    fireEvent.click(max()); // reversed
    expect(lastParams()).toEqual({ ordering: 'max_rating' });

    fireEvent.click(max()); // third click hands the board back to the default
    expect(lastParams()).toEqual({ ordering: '-elo_rating' });
  });

  it('flips the column the board already sits on', () => {
    renderPage();

    fireEvent.click(screen.getByText('Rating'));
    expect(lastParams()).toEqual({ ordering: 'elo_rating' });
  });

  it('sends the tier only once one is picked', () => {
    renderPage();

    fireEvent.click(screen.getByText('Filter by tier'));
    fireEvent.click(screen.getByText('Expert'));
    expect(lastParams()).toEqual({ ordering: '-elo_rating', tier: 'Expert' });
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

    fireEvent.click(screen.getByText('Rating')); // desc -> asc

    // Ascending drags the top places to the far end of the list, so a podium
    // would sit empty; the top places go back into the list instead.
    expect(container.querySelectorAll('.pod')).toHaveLength(0);
    expect(container.querySelectorAll('.st-list .st-row')).toHaveLength(5);
  });

  it('drops the podium and the floating bar under a tier filter', () => {
    // The world's top three happen to be in this tier, but a filtered board is
    // a search: everyone shows as an ordinary row, and nothing floats.
    useStandings.mockReturnValue({
      ...result(tied),
      you: coder('me', 9),
    });
    const { container } = renderPage();
    expect(container.querySelectorAll('.pod').length).toBeGreaterThan(0);
    expect(container.querySelector('.st-youbar')).toBeTruthy();

    fireEvent.click(screen.getByText('Filter by tier'));
    fireEvent.click(screen.getByText('Kernel'));

    expect(container.querySelectorAll('.pod')).toHaveLength(0);
    expect(container.querySelector('.st-youbar')).toBeNull();
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

describe('StandingsPage navigation', () => {
  it('opens a coder profile from a list row', () => {
    useStandings.mockReturnValue(result([coder('ann', 4)]));
    const { container } = renderPage();

    fireEvent.click(container.querySelector('.st-list .st-row'));
    expect(navigate).toHaveBeenCalledWith('/users/ann');
  });

  it('sends your own name to your own profile instead', () => {
    useStandings.mockReturnValue({
      ...result([coder('me', 4)]),
      you: coder('me', 4),
    });
    const { container } = renderPage();

    fireEvent.click(container.querySelector('.st-youbar .st-row'));
    expect(navigate).toHaveBeenCalledWith('/me');
  });

  it('opens the coder the podium tile is currently showing', () => {
    useStandings.mockReturnValue(result([coder('ann', 1), coder('bob', 1)]));
    const { container } = renderPage();

    fireEvent.click(container.querySelector('.pod'));
    expect(navigate).toHaveBeenCalledWith('/users/ann');
  });

  it('does not navigate when you page the tile with an arrow', () => {
    useStandings.mockReturnValue(result([coder('ann', 1), coder('bob', 1)]));
    const { container } = renderPage();

    fireEvent.click(container.querySelector('.pod-arw.next'));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('bob')).toBeTruthy();
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

  it('does not send you off to change a tier filter you never set', () => {
    useStandings.mockReturnValue({ ...result([]), total: 0 });
    renderPage();

    expect(screen.getByText('No coders found')).toBeTruthy();
    expect(screen.getByText(/nobody is ranked yet/)).toBeTruthy();

    // With a tier picked, the advice becomes worth taking.
    fireEvent.click(screen.getByText('Filter by tier'));
    fireEvent.click(screen.getByText('Kernel'));
    expect(screen.getByText(/No one holds this tier yet/)).toBeTruthy();
  });

  it('keeps showing the rows it has when an extra page fails to load', () => {
    useStandings.mockReturnValue({
      ...result([coder('ann', 4)]),
      error: new Error('boom'),
    });
    const { container } = renderPage();

    // The failure was an extra page; what is already on screen is still true.
    expect(screen.queryByText('Standings unavailable')).toBeNull();
    expect(container.querySelectorAll('.st-list .st-row')).toHaveLength(1);
  });

  it('hides the count it does not know yet rather than showing a zero', () => {
    useStandings.mockReturnValue({
      ...result([]),
      count: null,
      total: null,
      loading: true,
    });
    const { container } = renderPage();

    expect(container.querySelector('.st-head .sub')).toBeNull();
  });

  it('counts the tier against the whole board once one is picked', () => {
    useStandings.mockReturnValue({ ...result([coder('ann', 4)]), total: 10 });
    const { container } = renderPage();
    const sub = () => container.querySelector('.st-head .sub').textContent;

    expect(sub()).toBe('showing all 10 coders'); // unfiltered: the whole board

    fireEvent.click(screen.getByText('Filter by tier'));
    fireEvent.click(screen.getByText('Expert'));
    expect(sub()).toBe('showing 1 of 10 coders');
  });

  it('drops the your-standing bar when the api sends no row for you', () => {
    useStandings.mockReturnValue({ ...result([coder('ann', 1)]), you: null });
    const { container } = renderPage();

    expect(container.querySelector('.st-youbar')).toBeNull();
  });
});
