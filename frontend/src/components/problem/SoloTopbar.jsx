import { Link } from 'react-router-dom';
import Icons from '../Icons';
import UserMenu from '../layout/UserMenu';

/**
 * SoloTopbar — workspace top bar for solo problem solving (no contest chrome).
 *
 * Props:
 *   title       — problem title shown next to the logo
 *   user        — { username, initials } for the user menu
 *   onMenuClick — open the sidebar drawer (burger button)
 */
export default function SoloTopbar({ title, user, onMenuClick }) {
  return (
    <header className="pp-topbar">
      <div className="pp-tb-left">
        <button className="icon-btn" title="Menu" onClick={onMenuClick}>
          <Icons.menu size={18} />
        </button>
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
        <UserMenu user={user} />
      </div>
    </header>
  );
}
