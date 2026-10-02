import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { state } = vi.hoisted(() => ({ state: { count: 0 } }));
vi.mock('../../store/notificationsStore', () => ({
  useNotificationsStore: (selector) => selector(state),
}));

import NotificationBell from './NotificationBell';

const renderBell = (count, onClick = () => {}) => {
  state.count = count;
  return render(<NotificationBell onClick={onClick} />);
};

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

    expect(screen.getByRole('button').textContent).toBe('99');
  });

  it('caps the shown number at 99+ but reads out the exact one', () => {
    renderBell(120);

    const bell = screen.getByRole('button', {
      name: 'Notifications, 120 unread',
    });
    expect(bell.querySelector('.nbell-count').textContent).toBe('99+');
  });

  it('opens the feed on click', () => {
    const onClick = vi.fn();
    renderBell(1, onClick);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
