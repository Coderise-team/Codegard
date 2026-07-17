import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './OAuthCallbackPage.css';
import { useAuthStore } from '../store/authStore';
import { popOAuthFrom } from '../utils/oauthReturn';

/**
 * OAuthCallbackPage — transient landing for the provider round-trip.
 * The backend redirects here with `?ticket=<one-time>`; the page exchanges it
 * for the JWT pair and sends the user back where the flow started.
 */
export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginWithTicket = useAuthStore((s) => s.loginWithTicket);

  // The ticket is single-use with a short TTL, so the exchange must run
  // exactly once — StrictMode re-runs effects in dev and a second redeem
  // would land on /login with an "expired" error.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ticket = searchParams.get('ticket');
    (async () => {
      try {
        if (!ticket) throw new Error('missing_ticket');
        await loginWithTicket(ticket);
        navigate(popOAuthFrom(), { replace: true });
      } catch {
        navigate('/login?oauth_error=ticket', { replace: true });
      }
    })();
  }, [searchParams, loginWithTicket, navigate]);

  return (
    <div className="oauth-callback">
      <span className="spin" />
      Signing you in…
    </div>
  );
}
