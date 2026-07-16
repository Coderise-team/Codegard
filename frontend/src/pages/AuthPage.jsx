import { useEffect, useId, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import './AuthPage.css';
import { oauthStart } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { stashOAuthFrom } from '../utils/oauthReturn';

const TICKS = Array.from({ length: 50 }, (_, i) => i);

/**
 * Pull a human-readable message out of an API error.
 * DRF returns field errors as { field: ["msg", ...] } (e.g. register), or a
 * single { detail: "msg" }; fall back to the network/error message.
 */
function getErrorMessage(error) {
  const data = error?.response?.data;
  if (data && typeof data === 'object') {
    if (data.detail) return data.detail;
    const first = Object.values(data).flat().find(Boolean);
    if (first) return String(first);
  }
  return error?.message || 'Something went wrong';
}

/**
 * Human messages for the backend OAuth error slugs: `?oauth_error=<slug>` on
 * the provider round-trip, or `{ error: <slug> }` from the start endpoint.
 */
const OAUTH_ERROR_MESSAGES = {
  state: 'The sign-in attempt expired. Please try again.',
  ticket: 'The sign-in attempt expired. Please try again.',
  provider_not_configured: 'This sign-in method is not available right now.',
  token_exchange_failed: 'The provider rejected the sign-in. Please try again.',
  userinfo_failed:
    'Could not read your profile from the provider. Please try again.',
  email_not_verified:
    'Your email is not verified with the provider. Verify it there and try again.',
};

const oauthErrorMessage = (slug) =>
  OAUTH_ERROR_MESSAGES[slug] || 'Sign-in failed. Please try again.';

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function OAuthButtons({ onOAuth, disabled }) {
  return (
    <div className="auth-oauth">
      <button
        type="button"
        className="auth-oauth-btn"
        title="Continue with Google"
        onClick={() => onOAuth('google')}
        disabled={disabled}
      >
        <GoogleIcon />
      </button>
      <button
        type="button"
        className="auth-oauth-btn"
        title="Continue with GitHub"
        onClick={() => onOAuth('github')}
        disabled={disabled}
      >
        <GitHubIcon />
      </button>
    </div>
  );
}

function FloatInput({ type = 'text', label, value, onChange, autoComplete }) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && revealed ? 'text' : type;

  return (
    <div className="auth-field">
      <input
        id={id}
        type={inputType}
        placeholder=" "
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={isPassword ? 'auth-input-pw' : undefined}
        required
      />
      <label htmlFor={id}>{label}</label>
      {isPassword && (
        <button
          type="button"
          className="auth-eye"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      )}
    </div>
  );
}

function LoginForm({ onSwitch, onSubmit, onOAuth, loading, error }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ usernameOrEmail, password });
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2 className="auth-title">Login</h2>

      <FloatInput
        label="Username or email"
        type="text"
        value={usernameOrEmail}
        onChange={setUsernameOrEmail}
        autoComplete="username"
      />
      <FloatInput
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <div className="auth-forgot">
        <a href="#">Forgot your password?</a>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? <span className="auth-spin" /> : 'Login'}
      </button>

      <div className="auth-switch">
        Don't have an account?{' '}
        <button type="button" className="auth-switch-link" onClick={onSwitch}>
          Register
        </button>
      </div>

      <OAuthButtons onOAuth={onOAuth} disabled={loading} />
    </form>
  );
}

function RegisterForm({ onSwitch, onSubmit, onOAuth, loading, error }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ username, email, password });
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2 className="auth-title">Register</h2>

      <FloatInput
        label="Username"
        type="text"
        value={username}
        onChange={setUsername}
        autoComplete="username"
      />
      <FloatInput
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      <FloatInput
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? <span className="auth-spin" /> : 'Create account'}
      </button>

      <div className="auth-switch">
        Already have an account?{' '}
        <button type="button" className="auth-switch-link" onClick={onSwitch}>
          Login
        </button>
      </div>

      <OAuthButtons onOAuth={onOAuth} disabled={loading} />
    </form>
  );
}

/**
 * AuthPage — login / registration screen.
 * mode — 'login' | 'register'; set by the route (/login, /register).
 */
export default function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Page the user was sent here from (set by PrivateRoute); fall back to home.
  const from = location.state?.from?.pathname || '/';

  // The backend callback lands failures on /login?oauth_error=<slug>: surface
  // the message once and strip the param so a refresh doesn't resurface it.
  useEffect(() => {
    const slug = searchParams.get('oauth_error');
    if (!slug) return;
    setError(oauthErrorMessage(slug));
    const next = new URLSearchParams(searchParams);
    next.delete('oauth_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const wrap = async (action, data) => {
    setError('');
    setLoading(true);
    try {
      await action(data);
      navigate(from, { replace: true });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // Login form has one identity field; backend accepts a username or an email.
  const handleLogin = ({ usernameOrEmail, password }) =>
    wrap(login, { username: usernameOrEmail, password });
  const handleRegister = (data) => wrap(register, data);

  const handleOAuth = async (provider) => {
    setError('');
    setLoading(true);
    try {
      stashOAuthFrom(from);
      const { authorize_url } = await oauthStart(provider);
      // Full-page redirect to the provider; stay in the loading state so the
      // buttons cannot be clicked again while the browser navigates away.
      window.location.assign(authorize_url);
    } catch (e) {
      setError(oauthErrorMessage(getErrorMessage(e)));
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-ring">
        {TICKS.map((i) => (
          <span key={i} style={{ '--i': i }} />
        ))}

        <div className="auth-box">
          {mode === 'login' ? (
            <LoginForm
              onSwitch={() => navigate('/register')}
              onSubmit={handleLogin}
              onOAuth={handleOAuth}
              loading={loading}
              error={error}
            />
          ) : (
            <RegisterForm
              onSwitch={() => navigate('/login')}
              onSubmit={handleRegister}
              onOAuth={handleOAuth}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
