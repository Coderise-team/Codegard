import { Link, NavLink } from 'react-router-dom';
import Avatar from '../Avatar';
import Icons from '../Icons';

// App navigation — static app sections, not API data.
// Pages other than Dashboard are delivered in their own PRs.
const NAV = [
  { label: 'Dashboard', icon: 'home', to: '/' },
  { label: 'Problems', icon: 'grid', to: '/problems' },
  { label: 'Contests', icon: 'trophy', to: '/contests' },
  { label: 'Standings', icon: 'chart', to: '/standings' },
];

const linkClass = ({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`;

/**
 * Sidebar — left navigation panel. On phones (≤640) it becomes an off-canvas
 * drawer toggled via `open`; the scrim and nav links call `onClose`.
 *
 * Props:
 *   user    — { username, avatar }  (bottom mini card, links to own profile)
 *   open    — drawer open (phone only)
 *   onClose — close the drawer (scrim click / navigation)
 */
export default function Sidebar({ user, open = false, onClose }) {
  return (
    <>
      <div
        className={`side-scrim${open ? ' show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`side${open ? ' open' : ''}`}>
        <div className="side-top">
          <Link to="/" className="logo" onClick={onClose}>
            <span className="mark">C</span>
            <span>
              <span className="wm-a">Code</span>
              <span className="wm-b">gard</span>
            </span>
          </Link>
        </div>

        <nav className="side-nav scroll">
          {NAV.map((item) => {
            const Icon = Icons[item.icon] || Icons.grid;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={linkClass}
                onClick={onClose}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="side-foot">
          <Link
            to={user?.username ? `/users/${user.username}` : '/'}
            className="nav-mini"
            onClick={onClose}
          >
            <Avatar src={user?.avatar} username={user?.username} />
            <div className="mid">
              <div className="h">{user?.username}</div>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
