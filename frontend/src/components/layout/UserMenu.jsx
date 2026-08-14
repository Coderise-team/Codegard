import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../Avatar';
import Icons from '../Icons';
import { useAuthStore } from '../../store/authStore';
import './UserMenu.css';

/**
 * UserMenu — avatar chip in the topbar that opens a dropdown.
 *
 * Navigation only: editing lives on the profile page itself, behind the owner's
 * Edit profile button, so the menu just points there and logs out.
 *
 * Props:
 *   user — { username, avatar }
 */
export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  // Close on outside click or Escape while the menu is open.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="meta">
          <div className="handle">{user?.username}</div>
        </div>
        <Avatar src={user?.avatar} username={user?.username} />
      </button>

      {open && (
        <div className="user-pop" role="menu">
          <Link
            to={user?.username ? `/users/${user.username}` : '/'}
            className="um-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Icons.user size={16} /> My profile
          </Link>
          <div className="um-sep" />
          <button
            type="button"
            className="um-item danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <Icons.logout size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
