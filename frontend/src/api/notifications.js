import client from './client';

// GET notifications/ -> one page of the signed-in user's feed, newest first:
// { count, next, previous, results }. A row is
// { id, type, title, body, link, seen_at, created_at }; title and body are
// ready-made text, link is an internal path or "" when there is nowhere to go.
// `params` carries page (and page_size, 20 by default, capped at 50).
export async function getNotifications(params) {
  const { data } = await client.get('notifications/', { params });
  return data;
}

// GET notifications/unread-count/ -> { count }: how many rows are still unseen.
export async function getUnreadCount() {
  const { data } = await client.get('notifications/unread-count/');
  return data.count;
}

// POST notifications/seen/ { ids } -> { count }: marks only the rows that were
// actually on screen and answers with the unseen count left after that.
// The backend takes up to 1000 ids per call.
export async function markSeen(ids) {
  const { data } = await client.post('notifications/seen/', { ids });
  return data.count;
}
