import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import './ErrorBoundary.css';

/**
 * ErrorBoundary — the router's errorElement: the last line of defence against
 * a white screen when a route crashes while rendering.
 *
 * Deliberately standalone (no Sidebar/Navbar): the shell itself may be what
 * broke. The router stays alive, so "Go home" recovers without a full reload.
 * Error details are dev-only — never leak internals to users in production.
 */
export default function ErrorBoundary() {
  const error = useRouteError();

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error?.message || String(error);

  return (
    <div className="eb">
      <div className="eb-card">
        <div className="eb-mark">!</div>
        <h1 className="eb-t">Something went wrong</h1>
        <p className="eb-s">
          The page crashed on our side. Reloading usually helps — if it doesn’t,
          try again in a minute.
        </p>

        {import.meta.env.DEV && detail && (
          <pre className="eb-dev">{detail}</pre>
        )}

        <div className="eb-cta">
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <Link className="btn" to="/">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
