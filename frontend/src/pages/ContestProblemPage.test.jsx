import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// The page is pure orchestration: it wires a stack of hooks and then decides
// which of three things to show — the not-found screen, the not-a-participant
// gate, or the workspace. Stub the data layer and the heavy children (the
// workspace mounts Monaco) and assert on that decision.
const hooks = vi.hoisted(() => ({
  useContestProblem: vi.fn(),
  useLanguages: vi.fn(),
  useProblemSubmissions: vi.fn(),
  useSubmitFlow: vi.fn(),
  useContestPanel: vi.fn(),
  useMyStanding: vi.fn(),
  useLeaderboardSignal: vi.fn(),
  useThrottledSignal: vi.fn(),
}));

vi.mock('../hooks/useContestProblem', () => ({
  useContestProblem: hooks.useContestProblem,
}));
vi.mock('../hooks/useLanguages', () => ({ useLanguages: hooks.useLanguages }));
vi.mock('../hooks/useProblemSubmissions', () => ({
  useProblemSubmissions: hooks.useProblemSubmissions,
}));
vi.mock('../hooks/useSubmitFlow', () => ({
  useSubmitFlow: hooks.useSubmitFlow,
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
  useCurrentUser: () => ({ username: 'me', initials: 'ME' }),
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ id: '7', letter: 'A' }),
}));

vi.mock('../components/layout/Sidebar', () => ({ default: () => <div /> }));
vi.mock('../components/problem/ContestTopbar', () => ({
  default: () => <div data-testid="topbar" />,
}));
vi.mock('../components/problem/ProblemWorkspace', () => ({
  default: () => <div data-testid="workspace" />,
}));
vi.mock('../components/problem/VerdictToast', () => ({ default: () => null }));
vi.mock('../components/problem/ContestLeaderboard', () => ({
  default: () => <div />,
}));
// The gate reuses NotFoundPage; stub it to echo the heading the page chose.
vi.mock('./NotFoundPage', () => ({
  default: ({ title }) => <div data-testid="message">{title}</div>,
}));

import ContestProblemPage from './ContestProblemPage';

const iso = (ms) => new Date(Date.now() + ms).toISOString();
const liveContest = (over = {}) => ({
  id: 7,
  title: 'Codegard Cup #40',
  start_time: iso(-3600e3),
  end_time: iso(3600e3),
  is_joined: true,
  problems: [{ id: 11 }, { id: 12 }],
  ...over,
});

beforeEach(() => {
  hooks.useLanguages.mockReturnValue({
    data: [{ id: 1, name: 'Python' }],
    loading: false,
  });
  hooks.useProblemSubmissions.mockReturnValue({ data: [], reload: vi.fn() });
  hooks.useSubmitFlow.mockReturnValue({
    busy: false,
    toast: null,
    setToast: vi.fn(),
    submit: vi.fn(),
  });
  hooks.useContestPanel.mockReturnValue({
    reload: vi.fn(),
    reloadLoaded: vi.fn(),
  });
  hooks.useMyStanding.mockReturnValue({
    rank: null,
    score: 0,
    solved: 0,
    problems: [],
  });
  hooks.useLeaderboardSignal.mockReturnValue({ signal: 0, ended: false });
  hooks.useThrottledSignal.mockReturnValue(0);
});

describe('ContestProblemPage', () => {
  it('shows the not-found screen for an unknown round or letter', () => {
    hooks.useContestProblem.mockReturnValue({
      contest: null,
      problem: null,
      loading: false,
      notFound: true,
    });

    render(<ContestProblemPage />);
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Problem not found'
    );
    expect(screen.queryByTestId('workspace')).toBeNull();
  });

  it('locks out a non-participant instead of opening the workspace', () => {
    hooks.useContestProblem.mockReturnValue({
      contest: liveContest({ is_joined: false }),
      problem: { id: 11 },
      loading: false,
      notFound: false,
    });

    render(<ContestProblemPage />);
    expect(screen.getByTestId('message')).toHaveTextContent(
      "You're not in this round"
    );
    expect(screen.queryByTestId('workspace')).toBeNull();
  });

  it('opens the workspace for a registered participant', () => {
    hooks.useContestProblem.mockReturnValue({
      contest: liveContest({ is_joined: true }),
      problem: { id: 11 },
      loading: false,
      notFound: false,
    });

    render(<ContestProblemPage />);
    expect(screen.getByTestId('workspace')).toBeTruthy();
    expect(screen.getByTestId('topbar')).toBeTruthy();
    expect(screen.queryByTestId('message')).toBeNull();
  });
});
