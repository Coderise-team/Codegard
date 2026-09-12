import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import AppShell from './AppShell';

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => selector({ user: { username: 'ada' } }),
}));

const renderShell = (props) =>
  render(
    <MemoryRouter>
      <AppShell title="Problems" {...props}>
        <div>page body</div>
      </AppShell>
    </MemoryRouter>
  );

describe('AppShell', () => {
  it('puts the title in the top bar and keeps the page content', () => {
    const { container } = renderShell();

    // Queried by the breadcrumb itself: the sidebar carries a nav link of the
    // same name, so a text lookup would match either one.
    expect(container.querySelector('.crumb').textContent).toBe('Problems');
    expect(screen.getByText('page body')).toBeInTheDocument();
  });

  it('opens the drawer from the burger and closes it from the scrim', () => {
    const { container } = renderShell();
    const sidebar = container.querySelector('.side');

    expect(sidebar.className).not.toContain('open');

    fireEvent.click(screen.getByTitle('Menu'));
    expect(sidebar.className).toContain('open');

    fireEvent.click(container.querySelector('.side-scrim'));
    expect(sidebar.className).not.toContain('open');
  });

  it('passes a page its own class and variables on the frame root', () => {
    const { container } = renderShell({
      className: 'st-page',
      style: { '--rank-c': 'red' },
    });
    const root = container.querySelector('.dash');

    expect(root.className).toContain('st-page');
    expect(root.style.getPropertyValue('--rank-c')).toBe('red');
  });
});
