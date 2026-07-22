import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import OAuthCallbackPage from './OAuthCallbackPage';
import { stashOAuthFrom } from '../utils/oauthReturn';

const { navigate, loginWithTicket } = vi.hoisted(() => ({
  navigate: vi.fn(),
  loginWithTicket: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) => selector({ loginWithTicket }),
}));

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <OAuthCallbackPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  loginWithTicket.mockResolvedValue(undefined);
});

describe('OAuthCallbackPage', () => {
  it('redeems the ticket and returns to the stashed page', async () => {
    stashOAuthFrom('/problems/5');
    renderAt('/oauth/callback?ticket=t1');

    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
    await waitFor(() => expect(loginWithTicket).toHaveBeenCalledWith('t1'));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/problems/5', { replace: true })
    );
  });

  it('falls back to home when nothing is stashed', async () => {
    renderAt('/oauth/callback?ticket=t1');

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/', { replace: true })
    );
  });

  it('sends a failed redeem to /login with an oauth error', async () => {
    loginWithTicket.mockRejectedValue(new Error('invalid ticket'));
    renderAt('/oauth/callback?ticket=bad');

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/login?oauth_error=ticket', {
        replace: true,
      })
    );
  });

  it('sends a missing ticket to /login without calling redeem', async () => {
    renderAt('/oauth/callback');

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/login?oauth_error=ticket', {
        replace: true,
      })
    );
    expect(loginWithTicket).not.toHaveBeenCalled();
  });

  // The ticket is single-use: a second redeem would fail on the backend.
  it('redeems exactly once under StrictMode double effects', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/oauth/callback?ticket=t1']}>
          <OAuthCallbackPage />
        </MemoryRouter>
      </StrictMode>
    );

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(loginWithTicket).toHaveBeenCalledTimes(1);
  });
});
