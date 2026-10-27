import { Outlet } from 'react-router-dom';
import { useUnreadCountSync } from '../hooks/useUnreadCountSync';

/**
 * NotificationsSync - the root route's element. Keeps the bell's unread count
 * current for the whole app and renders the matched page below it.
 *
 * Sits above every route, not inside PrivateRoute: the dashboard on `/` is
 * outside that guard, and one socket for the session means a page change
 * never drops it. For a guest the hook stays switched off.
 */
export default function NotificationsSync() {
  useUnreadCountSync();
  return <Outlet />;
}
