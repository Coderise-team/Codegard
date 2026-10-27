import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { state } = vi.hoisted(() => ({ state: { count: 0 } }));
vi.mock('../../store/notificationsStore', () => ({
  useNotificationsStore: (selector) => selector(state),
}));
// The panel has its own tests; here it only has to open and close.
vi.mock('./NotificationPanel', () => ({
  default: ({ onClose }) => (
    <div role="dialog" aria-label="Notifications">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import NotificationBell from './NotificationBell';

const renderBell = (count) => {
  state.count = count;
  return render(<NotificationBell />);
};

const bellButton = () => screen.getByRole('button', { name: /^Notifications/ });

describe('NotificationBell', () => {
  it('shows no number and stays still when nothing is unread', () => {
    const { container } = renderBell(0);

    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(container.querySelector('.nbell-count')).toBeNull();
    expect(bell.classList.contains('has-unread')).toBe(false);
  });

  it('shows the unread number, says it aloud and starts to shake', () => {
    renderBell(3);

    const bell = screen.getByRole('button', {
      name: 'Notifications, 3 unread',
    });
    expect(bell.querySelector('.nbell-count').textContent).toBe('3');
    expect(bell.classList.contains('has-unread')).toBe(true);
  });

  it('shows a two-digit number in full', () => {
    renderBell(99);

    expect(bellButton().textContent).toBe('99');
  });

  it('caps the shown number at 99+ but reads out the exact one', () => {
    renderBell(120);

    const bell = screen.getByRole('button', {
      name: 'Notifications, 120 unread',
    });
    expect(bell.querySelector('.nbell-count').textContent).toBe('99+');
  });

  it('opens the feed on click and closes it again', () => {
    renderBell(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bellButton().getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(bellButton());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(bellButton().getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
