import Icons from '../Icons';
import { useNotificationsStore } from '../../store/notificationsStore';
import './NotificationBell.css';

// Past this the exact number stops mattering to the reader: "a lot" is enough,
// and the badge stays small enough to keep the bell visible.
const MAX_SHOWN = 99;

/**
 * NotificationBell - the bell in a top bar, with the unread count on it.
 *
 * The number comes from the notifications store, so every top bar that mounts
 * a bell shows the same one. While anything is unread the bell shakes now and
 * then to draw the eye; the stylesheet keeps it still for anyone whose system
 * asks for reduced motion.
 *
 * Props:
 *   onClick - open the feed
 */
export default function NotificationBell({ onClick }) {
  const count = useNotificationsStore((s) => s.count);
  const shown = count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);

  return (
    <button
      type="button"
      className={`icon-btn nbell${count > 0 ? ' has-unread' : ''}`}
      title="Notifications"
      aria-label={
        count > 0 ? `Notifications, ${count} unread` : 'Notifications'
      }
      onClick={onClick}
    >
      <Icons.bell size={17} />
      {count > 0 && (
        <span className="nbell-count" aria-hidden="true">
          {shown}
        </span>
      )}
    </button>
  );
}
