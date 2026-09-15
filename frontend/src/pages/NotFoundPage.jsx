import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import './NotFoundPage.css';

/**
 * NotFoundPage — a full-screen message rendered inside the app shell so the
 * user keeps working navigation instead of hitting a dead end.
 *
 * Serves the catch-all 404 (unknown URL), pages whose resource is missing on
 * the backend, and "you can't be here" gates (e.g. a contest problem opened by
 * a non-participant) — each passes its own copy, code and call to action.
 *
 * Props:
 *   code     — the big glyph over the heading; pass null to hide it (a gate is
 *              not a 404, so it shows no code)
 *   title    — heading
 *   sub      — supporting line
 *   navTitle — the top-bar label
 *   to / cta — the primary link target and its label
 */
export default function NotFoundPage({
  code = '404',
  title = 'Page not found',
  sub = 'This page does not exist, or the link is out of date.',
  navTitle = 'Not found',
  to = '/',
  cta = 'Go to dashboard',
}) {
  return (
    <AppShell title={navTitle}>
      <div className="canvas scroll">
        <div className="canvas-in">
          <section className="nf">
            {code != null && <div className="nf-code">{code}</div>}
            <h1 className="nf-t">{title}</h1>
            <p className="nf-s">{sub}</p>

            <div className="nf-cta">
              <Link className="btn btn-primary" to={to}>
                {cta}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
