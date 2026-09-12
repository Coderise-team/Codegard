import Icons from '../Icons';
import UserMenu from './UserMenu';

/**
 * Navbar — top dashboard bar (breadcrumb, search, user menu).
 *
 * Search belongs to the page below, not to the bar: every page searches its own
 * thing, and a page with nothing to search declares nothing and gets no field.
 *
 * Props:
 *   user        — { username, avatar }
 *   title       — breadcrumb (string or markup)
 *   onMenuClick — open the sidebar drawer (phone only; burger button)
 *   search      — { placeholder, value, onChange } from the page, or nothing
 */
export default function Navbar({
  user,
  title = 'Dashboard',
  onMenuClick,
  search,
}) {
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

      {search && (
        <div className="gsearch">
          <Icons.search size={15} />
          <input
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
          />
          <span className="kbd">/</span>
        </div>
      )}

      <UserMenu user={user} />
    </header>
  );
}
