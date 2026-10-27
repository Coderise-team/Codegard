import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { feed, track } = vi.hoisted(() => ({
  feed: { current: null },
  track: vi.fn(),
}));
vi.mock('../../hooks/useNotificationFeed', () => ({
  useNotificationFeed: () => feed.current,
}));
vi.mock('../../hooks/useSeenTracker', () => ({
  useSeenTracker: () => track,
}));

import Icons from '../Icons';
import NotificationPanel from './NotificationPanel';

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

const row = (over = {}) => ({
  id: 1,
  type: 'rating_changed',
  title: 'Rating changed',
  body: '+37 → 1461',
  link: '/users/alice',
  seen_at: null,
  created_at: minutesAgo(5),
  fresh: true,
  ...over,
});

const setFeed = (over = {}) => {
  feed.current = {
    items: [],
    loading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    reload: vi.fn(),
    ...over,
  };
};

const renderPanel = (onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <NotificationPanel onClose={onClose} />
    </MemoryRouter>
  );

beforeEach(() => {
  track.mockReset();
  setFeed();
});

describe('NotificationPanel', () => {
  it('opens as the Notifications dialog at the right edge', () => {
    renderPanel();

    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(dialog.classList.contains('is-drawer')).toBe(true);
  });

  it('says it is loading before the first page arrives', () => {
    setFeed({ loading: true });
    renderPanel();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('tells an empty feed apart from a failed one', () => {
    renderPanel();
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('offers to load again when the first page failed', () => {
    setFeed({ error: new Error('offline') });
    renderPanel();

    expect(screen.getByText('Notifications unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(feed.current.reload).toHaveBeenCalledTimes(1);
  });

  it('shows the ready-made text, the age and the highlight of a new row', () => {
    setFeed({
      items: [
        row(),
        row({
          id: 2,
          title: 'New rank',
          body: 'You reached Expert',
          fresh: false,
        }),
      ],
    });
    renderPanel();

    expect(screen.getByText('Rating changed')).toBeInTheDocument();
    expect(screen.getByText('+37 → 1461')).toBeInTheDocument();
    expect(screen.getAllByText('5m ago')).toHaveLength(2);
    const [fresh, old] = screen.getAllByRole('listitem');
    expect(fresh.classList.contains('fresh')).toBe(true);
    expect(old.classList.contains('fresh')).toBe(false);
  });

  it('a row with a link goes there and closes the panel', () => {
    const onClose = vi.fn();
    setFeed({ items: [row()] });
    renderPanel(onClose);

    const link = screen.getByRole('link', { name: /Rating changed/ });
    expect(link.getAttribute('href')).toBe('/users/alice');
    fireEvent.click(link);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a row without a link is plain text', () => {
    setFeed({ items: [row({ link: '' })] });
    renderPanel();

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Rating changed')).toBeInTheDocument();
  });

  it('watches only the rows still unseen on the server', () => {
    setFeed({
      items: [
        row({ id: 7 }),
        row({ id: 8, seen_at: '2026-10-01T10:00:00Z', fresh: false }),
      ],
    });
    renderPanel();

    const watched = track.mock.calls.map(([node]) => node).filter(Boolean);
    expect(watched).toHaveLength(1);
    expect(watched[0].dataset.seenId).toBe('7');
    const [, seen] = screen.getAllByRole('listitem');
    expect(seen.hasAttribute('data-seen-id')).toBe(false);
  });

  it('gives each kind its own icon and an unknown kind the bell', () => {
    setFeed({
      items: [
        row({ id: 1, type: 'contest_started' }),
        row({ id: 2, type: 'something_new' }),
      ],
    });
    renderPanel();
    const drawn = (Icon) =>
      render(<Icon size={16} />).container.querySelector('svg').innerHTML;

    const icons = [...document.querySelectorAll('.np-ic svg')];
    expect(icons[0].innerHTML).toBe(drawn(Icons.trophy));
    expect(icons[1].innerHTML).toBe(drawn(Icons.bell));
  });

  it('keeps a loading line under the list while more pages remain', () => {
    setFeed({ items: [row()], hasMore: true });
    renderPanel();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('offers to retry when the next page failed', () => {
    setFeed({ items: [row()], hasMore: true, error: new Error('offline') });
    renderPanel();

    expect(screen.getByText(/Could not load more/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(feed.current.loadMore).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('offers no retry for rows a ring brought in after a failed first load', () => {
    setFeed({ items: [row()], hasMore: false, error: new Error('offline') });
    renderPanel();

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText(/Could not load more/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
