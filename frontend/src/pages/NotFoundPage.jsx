import { useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import { useCurrentUser } from '../hooks/useCurrentUser';
import './NotFoundPage.css';

/**
 * NotFoundPage — the 404 screen, rendered inside the app shell so the user
 * keeps working navigation instead of hitting a dead end.
 *
 * Serves two cases: the catch-all route (unknown URL) and pages whose resource
 * is missing on the backend — those pass their own title/sub.
 *
 * Props:
 *   title — heading (default: unknown page)
 *   sub   — supporting line
 */
export default function NotFoundPage({
  title = 'Page not found',
  sub = 'This page does not exist, or the link is out of date.',
}) {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="dash" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
          title="Not found"
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="canvas scroll">
          <div className="canvas-in">
            <section className="nf">
              <div className="nf-code">404</div>
              <h1 className="nf-t">{title}</h1>
              <p className="nf-s">{sub}</p>

              <div className="nf-cta">
                <Link className="btn btn-primary" to="/">
                  Go to dashboard
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
