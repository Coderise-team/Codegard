import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => selector({ logout: vi.fn() }),
}));

import UserMenu from './UserMenu';

const renderMenu = (user) =>
  render(
    <MemoryRouter>
      <UserMenu user={user} />
    </MemoryRouter>
  );

describe('UserMenu', () => {
  it('points My profile at the signed-in user page', () => {
    renderMenu({ username: 'n3ptune', avatar: null });

    // The dropdown is closed until the chip is clicked.
    fireEvent.click(screen.getByRole('button', { name: /n3ptune/i }));

    expect(
      screen.getByRole('menuitem', { name: /my profile/i }).getAttribute('href')
    ).toBe('/users/n3ptune');
  });

  it('shows the picture of a user who has one', () => {
    const { container } = renderMenu({
      username: 'n3ptune',
      avatar: '/media/avatars/thumbs/abc.webp',
    });

    expect(container.querySelector('.avatar-img').getAttribute('src')).toBe(
      '/media/avatars/thumbs/abc.webp'
    );
    // The chip is still found by the username: the picture adds no label of
    // its own, so the button keeps reading as the account it belongs to.
    expect(
      screen.getByRole('button', { name: /n3ptune/i })
    ).toBeInTheDocument();
  });
});
