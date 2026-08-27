import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import HomeRoute from './HomeRoute';

const auth = vi.hoisted(() => ({ isAuthenticated: false, isHydrating: false }));
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) =>
    selector({
      isAuthenticated: auth.isAuthenticated,
      isHydrating: auth.isHydrating,
    }),
}));

// Both pages fetch and lay out a whole screen; the question here is only which
// of the two the root picks.
vi.mock('../pages/Dashboard', () => ({
  default: () => <div>Dashboard</div>,
}));
vi.mock('../pages/LandingPage', () => ({
  default: () => <div>Landing</div>,
}));

describe('HomeRoute', () => {
  it('gives the dashboard to a signed-in member', () => {
    auth.isAuthenticated = true;
    auth.isHydrating = false;
    render(<HomeRoute />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
  });

  it('gives the landing page to a guest', () => {
    auth.isAuthenticated = false;
    auth.isHydrating = false;
    render(<HomeRoute />);
    expect(screen.getByText('Landing')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows neither while the session is still being restored', () => {
    auth.isAuthenticated = false;
    auth.isHydrating = true;
    render(<HomeRoute />);
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
