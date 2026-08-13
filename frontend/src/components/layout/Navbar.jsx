import Icons from '../Icons';
import UserMenu from './UserMenu';

/**
 * Navbar — top dashboard bar (breadcrumb, search, user menu).
 *
 * Props:
 *   user        — { username, avatar }
 *   title       — breadcrumb string (e.g. "Dashboard")
 *   onMenuClick — open the sidebar drawer (phone only; burger button)
 */
export default function Navbar({ user, title = 'Dashboard', onMenuClick }) {
  return (
    <header className="tbar">
      <button
        className="nav-burger icon-btn"
        title="Menu"
        onClick={onMenuClick}
      >
        <Icons.menu size={18} />
      </button>
      <div className="crumb">{title}</div>
      <div className="tbar-spacer" />

      <div className="gsearch">
        <Icons.search size={15} />
        <input placeholder="Search problems, users, contests…" />
        <span className="kbd">/</span>
      </div>

      <UserMenu user={user} />
    </header>
  );
}
