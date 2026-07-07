import { Link } from 'react-router-dom';

/**
 * SoloTopbar — workspace top bar for solo problem solving (no contest chrome).
 *
 * Props:
 *   title — problem title shown next to the logo
 *   user  — { handle, rating, rank, initials } for the user chip
 */
export default function SoloTopbar({ title, user }) {
  return (
    <header className="pp-topbar">
      <div className="pp-tb-left">
        <Link to="/" className="logo">
          <span className="mark">C</span>
          <span>
            <span className="wm-a">Code</span>
            <span className="wm-b">gard</span>
          </span>
        </Link>
        <div className="pp-tb-div" />
        <div className="pp-tb-title">{title}</div>
      </div>

      <div className="pp-tb-right">
        <div className="pp-user-chip">
          <div className="pp-user-meta">
            <div className="pp-user-handle">{user.handle}</div>
            <div className="pp-user-rating">
              {user.rating} · {user.rank}
            </div>
          </div>
          <div className="avatar">{user.initials}</div>
        </div>
      </div>
    </header>
  );
}
