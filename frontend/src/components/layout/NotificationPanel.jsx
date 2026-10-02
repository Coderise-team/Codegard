import { Link } from 'react-router-dom';

import Icons from '../Icons';
import Modal from '../Modal';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useNotificationFeed } from '../../hooks/useNotificationFeed';
import { useSeenTracker } from '../../hooks/useSeenTracker';
import { timeAgo } from '../../utils/time';
import './NotificationPanel.css';

// The icon a row gets, by what the notification is about. An unknown type
// falls back to the bell rather than breaking the row.
const TYPE_ICONS = {
  rating_changed: 'chart',
  rank_changed: 'award',
  contest_started: 'trophy',
  contest_ended: 'trophy',
  contest_starting_soon: 'trophy',
  new_problem: 'grid',
  report_resolved: 'flag',
};

function NotificationRow({ notification, track, onClose }) {
  const { id, type, title, body, link, seen_at, created_at, fresh } =
    notification;
  const Icon = Icons[TYPE_ICONS[type]] || Icons.bell;
  // Only rows still unseen on the server need watching.
  const unseen = seen_at === null;
  const content = (
    <>
      <span className="np-ic">
        <Icon size={16} />
      </span>
      <span className="np-main">
        <span className="np-title">{title}</span>
        <span className="np-text">{body}</span>
      </span>
      <time className="np-time" dateTime={created_at}>
        {timeAgo(created_at)}
      </time>
    </>
  );

  return (
    <li
      className={`np-row${fresh ? ' fresh' : ''}`}
      data-seen-id={unseen ? id : undefined}
      ref={unseen ? track : undefined}
    >
      {link ? (
        <Link className="np-item" to={link} onClick={onClose}>
          {content}
        </Link>
      ) : (
        <div className="np-item">{content}</div>
      )}
    </li>
  );
}

/**
 * NotificationPanel — the feed, in a panel at the right edge of the screen.
 *
 * Mounted only while open: opening loads the newest page, closing drops the
 * list and sends what was seen. Rows that were new when they arrived stay
 * highlighted until the panel closes. A row with a link closes the panel and
 * goes there; a row without one is plain text.
 *
 * Props:
 *   onClose — close the panel
 */
export default function NotificationPanel({ onClose }) {
  const { items, loading, error, hasMore, loadMore, reload } =
    useNotificationFeed();
  const track = useSeenTracker();
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !error);

  let content;
  if (loading) {
    content = <div className="np-msg">Loading…</div>;
  } else if (error && items.length === 0) {
    content = (
      <div className="np-state">
        <div className="ei failed">
          <Icons.x size={20} />
        </div>
        <div className="et">Notifications unavailable</div>
        <div className="es">The feed could not be loaded.</div>
        <button type="button" className="btn btn-sm" onClick={reload}>
          Try again
        </button>
      </div>
    );
  } else if (items.length === 0) {
    content = (
      <div className="np-state">
        <div className="ei">
          <Icons.bell size={20} />
        </div>
        <div className="et">No notifications yet</div>
        <div className="es">
          Contest results, new problems and answers to your reports will show up
          here.
        </div>
      </div>
    );
  } else {
    content = (
      <>
        <ul className="np-list">
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              track={track}
              onClose={onClose}
            />
          ))}
        </ul>
        {/* Only a failed next page earns a retry here: after a failed first
            load the rows on screen came from a ring, and no next page is
            known yet to retry. */}
        {error && hasMore ? (
          <div className="np-msg">
            Could not load more.{' '}
            <button type="button" className="np-retry" onClick={loadMore}>
              Try again
            </button>
          </div>
        ) : (
          hasMore && (
            <div className="np-msg" ref={sentinelRef}>
              Loading…
            </div>
          )
        )}
      </>
    );
  }

  return (
    <Modal title="Notifications" onClose={onClose} placement="right">
      <div className="np-body scroll">{content}</div>
    </Modal>
  );
}
