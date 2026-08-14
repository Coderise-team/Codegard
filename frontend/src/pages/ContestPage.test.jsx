import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ContestPage wires the data layer to the banner + aside. Its own logic is the
// optimistic register/unregister flip (with a revert on failure) and the phase
// -> panel-kind mapping. Stub the children and hooks and drive that.
const hooks = vi.hoisted(() => ({
  useContest: vi.fn(),
  useContestPanel: vi.fn(),
  useMyStanding: vi.fn(),
  useLeaderboardSignal: vi.fn(),
  useThrottledSignal: vi.fn(),
}));
const api = vi.hoisted(() => ({
  joinContest: vi.fn(),
  leaveContest: vi.fn(),
}));

vi.mock('../hooks/useContest', async (importOriginal) => ({
  ...(await importOriginal()), // keep the real contestState helper
  useContest: hooks.useContest,
}));
vi.mock('../hooks/useContestPanel', () => ({
  useContestPanel: hooks.useContestPanel,
}));
vi.mock('../hooks/useMyStanding', () => ({
  useMyStanding: hooks.useMyStanding,
}));
vi.mock('../hooks/useLeaderboardSignal', () => ({
  useLeaderboardSignal: hooks.useLeaderboardSignal,
}));
vi.mock('../hooks/useThrottledSignal', () => ({
  useThrottledSignal: hooks.useThrottledSignal,
}));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ username: 'me', avatar: null }),
}));
vi.mock('../api/contests', () => ({
  joinContest: api.joinContest,
  leaveContest: api.leaveContest,
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ id: '7' }),
}));

vi.mock('../components/layout/Sidebar', () => ({ default: () => <div /> }));
vi.mock('../components/layout/Navbar', () => ({ default: () => <div /> }));
vi.mock('../components/contests/ContestAside', () => ({
  default: () => <div />,
}));
// The banner stands in for the CTA: it exposes the registered flag it was given
// and a button that fires the page's toggle.
vi.mock('../components/contests/ContestBanner', () => ({
  default: (props) => (
    <button data-testid="reg" onClick={props.onToggle}>
      reg:{String(props.registered)} state:{props.state} probs:
      {props.D.problems.length}
    </button>
  ),
}));

import ContestPage from './ContestPage';

const iso = (ms) => new Date(Date.now() + ms).toISOString();
const contest = (over = {}) => ({
  id: 7,
  title: 'Codegard Cup #40',
  start_time: iso(3600e3), // upcoming by default -> state "soon"
  end_time: iso(7200e3),
  participants_count: 10,
  problems_count: 2,
  problems: [],
  is_joined: false,
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContestPage />
    </MemoryRouter>
  );

beforeEach(() => {
  hooks.useContestPanel.mockReturnValue({
    reload: vi.fn(),
    reloadLoaded: vi.fn(),
  });
  hooks.useMyStanding.mockReturnValue(null);
  hooks.useLeaderboardSignal.mockReturnValue({ signal: 0, ended: false });
  hooks.useThrottledSignal.mockReturnValue(0);
  api.joinContest.mockResolvedValue({});
  api.leaveContest.mockResolvedValue({});
  hooks.useContest.mockReturnValue({
    contest: contest(),
    loading: false,
    error: null,
    reload: vi.fn(),
  });
});

describe('ContestPage registration', () => {
  it('flips to registered the moment you click, then calls the api', () => {
    renderPage();
    expect(screen.getByTestId('reg').textContent).toContain('reg:false');

    fireEvent.click(screen.getByTestId('reg'));

    // optimistic: the flag flips before the request settles
    expect(screen.getByTestId('reg').textContent).toContain('reg:true');
    expect(api.joinContest).toHaveBeenCalledWith('7');
  });

  it('reverts the flip when leaving fails', async () => {
    hooks.useContest.mockReturnValue({
      contest: contest({ is_joined: true }),
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    api.leaveContest.mockRejectedValue(new Error('boom'));

    renderPage();
    fireEvent.click(screen.getByTestId('reg'));

    // optimistic off, then the failure snaps it back on
    expect(screen.getByTestId('reg').textContent).toContain('reg:false');
    await waitFor(() =>
      expect(screen.getByTestId('reg').textContent).toContain('reg:true')
    );
    expect(api.leaveContest).toHaveBeenCalledWith('7');
  });
});

describe('ContestPage panel kind', () => {
  it('shows the registrants panel and locked problem slots before the start', () => {
    renderPage();

    // upcoming -> the aside lists registrants, not standings
    expect(hooks.useContestPanel).toHaveBeenLastCalledWith('7', 'registrants');
    // the problems are drawn from the count alone (backend hides them pre-start)
    expect(screen.getByTestId('reg').textContent).toContain('state:soon');
    expect(screen.getByTestId('reg').textContent).toContain('probs:2');
  });

  it('shows the leaderboard panel once the round is live', () => {
    hooks.useContest.mockReturnValue({
      contest: contest({ start_time: iso(-3600e3), end_time: iso(3600e3) }),
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    renderPage();
    expect(hooks.useContestPanel).toHaveBeenLastCalledWith('7', 'leaderboard');
  });
});
