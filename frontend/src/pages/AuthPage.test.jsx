import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import AuthPage from './AuthPage';

const { navigate, login, register, oauthStart, stash, redirect } = vi.hoisted(
  () => ({
    navigate: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    oauthStart: vi.fn(),
    stash: vi.fn(),
    redirect: vi.fn(),
  })
);

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) =>
    selector({ login, register, isAuthenticated: false }),
}));

vi.mock('../api/auth', () => ({ oauthStart }));

vi.mock('../utils/oauthReturn', () => ({
  stashOAuthFrom: stash,
  redirectToProvider: redirect,
}));

// Probe for asserting what the router URL looks like after effects run.
function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
}

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  login.mockResolvedValue(undefined);
  register.mockResolvedValue(undefined);
});

describe('AuthPage', () => {
  it('renders the login form by default', () => {
    renderInRouter(<AuthPage />);

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
  });

  it('toggles password visibility with the reveal button', () => {
    renderInRouter(<AuthPage />);

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('renders the register form when mode is "register"', () => {
    renderInRouter(<AuthPage mode="register" />);

    expect(
      screen.getByRole('heading', { name: 'Register' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create account' })
    ).toBeInTheDocument();
    expect(screen.getByText(/already have an account\?/i)).toBeInTheDocument();
  });

  it('submits login with the identity mapped to username, then redirects', async () => {
    renderInRouter(<AuthPage />);

    fireEvent.change(screen.getByLabelText('Username or email'), {
      target: { value: 'a@b.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        username: 'a@b.io',
        password: 'secret',
      })
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/', { replace: true })
    );
  });

  it('shows a failed login in the banner and leaves the fields unmarked', async () => {
    login.mockRejectedValue({
      response: { data: { detail: 'Incorrect username/email or password.' } },
    });
    renderInRouter(<AuthPage />);

    fireEvent.change(screen.getByLabelText('Username or email'), {
      target: { value: 'a@b.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(
      await screen.findByText('Incorrect username/email or password.')
    ).toBeInTheDocument();
    // A form-level error is not tied to a field, so neither input is flagged.
    expect(screen.getByLabelText('Username or email')).not.toHaveAttribute(
      'aria-invalid'
    );
    expect(screen.getByLabelText('Password')).not.toHaveAttribute(
      'aria-invalid'
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('surfaces DRF field errors (no detail) on failed register', async () => {
    register.mockRejectedValue({
      response: {
        data: { username: ['A user with that username already exists.'] },
      },
    });
    renderInRouter(<AuthPage mode="register" />);

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('A user with that username already exists.')
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('surfaces every field error under its own field on failed register', async () => {
    register.mockRejectedValue({
      response: {
        data: {
          username: ['A user with that username already exists.'],
          password: ['This password is too common.'],
        },
      },
    });
    renderInRouter(<AuthPage mode="register" />);

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText(/A user with that username already exists\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This password is too common\./)
    ).toBeInTheDocument();
    // Each error is tied to its field, not dumped into the form banner.
    expect(screen.getByLabelText('Username')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to /register when the switch link is clicked', () => {
    renderInRouter(<AuthPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(navigate).toHaveBeenCalledWith('/register');
  });

  it('starts the oauth flow: stashes the origin and redirects to the provider', async () => {
    oauthStart.mockResolvedValue({ authorize_url: 'https://provider/auth' });
    renderInRouter(<AuthPage />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with Google' })
    );

    await waitFor(() => expect(oauthStart).toHaveBeenCalledWith('google'));
    expect(stash).toHaveBeenCalledWith('/');
    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith('https://provider/auth')
    );
  });

  it('shows a human message when the oauth start fails', async () => {
    oauthStart.mockRejectedValue({
      response: { data: { error: 'provider_not_configured' } },
    });
    renderInRouter(<AuthPage mode="register" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with GitHub' })
    );

    expect(oauthStart).toHaveBeenCalledWith('github');
    expect(
      await screen.findByText('This sign-in method is not available right now.')
    ).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('re-enables the buttons when the page is restored from bfcache', async () => {
    oauthStart.mockResolvedValue({ authorize_url: 'https://provider/auth' });
    renderInRouter(<AuthPage />);

    const google = screen.getByRole('button', { name: 'Continue with Google' });
    fireEvent.click(google);
    await waitFor(() => expect(redirect).toHaveBeenCalled());
    expect(google).toBeDisabled();

    const pageshow = new Event('pageshow');
    Object.defineProperty(pageshow, 'persisted', { value: true });
    fireEvent(window, pageshow);

    await waitFor(() => expect(google).not.toBeDisabled());
  });

  it('shows the mapped oauth_error message from the URL and strips the param', async () => {
    render(
      <MemoryRouter initialEntries={['/login?oauth_error=email_not_verified']}>
        <AuthPage />
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/your email is not verified/i)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/)
    );
  });

  it('falls back to a generic message for an unknown oauth_error slug', async () => {
    render(
      <MemoryRouter initialEntries={['/login?oauth_error=whatever']}>
        <AuthPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Sign-in failed. Please try again.')
    ).toBeInTheDocument();
  });
});
