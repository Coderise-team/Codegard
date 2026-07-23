import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => selector({ logout: vi.fn() }),
}));

import UserMenu from './UserMenu';

describe('UserMenu', () => {
  it('points My profile at the signed-in user page', () => {
    render(
      <MemoryRouter>
        <UserMenu user={{ username: 'n3ptune', initials: 'N3' }} />
      </MemoryRouter>
    );

    // The dropdown is closed until the chip is clicked.
    fireEvent.click(screen.getByRole('button', { name: /n3ptune/i }));

    expect(
      screen.getByRole('menuitem', { name: /my profile/i }).getAttribute('href')
    ).toBe('/users/n3ptune');
  });
});
