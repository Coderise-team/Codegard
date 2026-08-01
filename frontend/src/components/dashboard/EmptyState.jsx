import { Link } from 'react-router-dom';
import Icons from '../Icons';

/**
 * EmptyState — empty-card placeholder for lists with no data (new users).
 *
 * Props:
 *   icon  — key from Icons (default "doc")
 *   title — heading
 *   sub   — supporting line
 *   cta   — optional button label; only rendered together with `to`
 *   to    — router path the button navigates to
 */
export default function EmptyState({ icon = 'doc', title, sub, cta, to }) {
  const Icon = Icons[icon] || Icons.doc;
  return (
    <section className="card">
      <div className="empty-card">
        <div className="ei">
          <Icon size={20} />
        </div>
        <div className="et">{title}</div>
        <div className="es">{sub}</div>
        {cta && to && (
          <Link className="btn btn-primary btn-sm" to={to}>
            {cta}
          </Link>
        )}
      </div>
    </section>
  );
}
