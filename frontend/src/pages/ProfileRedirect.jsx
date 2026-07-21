import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * /profile — a shortcut to your own profile, not a page of its own.
 *
 * It only redirects, so the address bar always ends up on the canonical
 * /users/:username: that link stays correct when copied and sent to someone
 * else, while /profile would take them to their profile instead.
 *
 * `replace` keeps /profile out of the history — Back would bounce off it
 * straight back to the profile otherwise.
 */
export default function ProfileRedirect() {
  const username = useAuthStore((s) => s.user?.username);

  return <Navigate to={username ? `/users/${username}` : '/'} replace />;
}
