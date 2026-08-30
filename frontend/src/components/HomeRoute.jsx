import { useAuthStore } from '../store/authStore';
import Dashboard from '../pages/Dashboard';
import LandingPage from '../pages/LandingPage';

/**
 * HomeRoute — decides what the site's root is for whoever asks: the dashboard
 * for a signed-in member, the landing page for a guest.
 *
 * Nothing is rendered while the session is still being restored. Guessing wrong
 * for even one frame is visible either way — a guest would see the dashboard
 * flash before being handed the landing, and a member would meet a marketing
 * page they have already been sold. Both guards beside this one hold their
 * render for the same reason.
 *
 * Deciding here rather than redirecting keeps the address bar honest: the root
 * stays the root, and no link anywhere has to know which of the two it leads to.
 */
export default function HomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  if (isHydrating) return null;

  return isAuthenticated ? <Dashboard /> : <LandingPage />;
}
