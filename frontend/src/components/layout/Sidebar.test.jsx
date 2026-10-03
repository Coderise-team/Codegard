import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Sidebar from './Sidebar';

const renderSidebar = (user) =>
  render(
    <MemoryRouter>
      <Sidebar user={user} onClose={() => {}} />
    </MemoryRouter>
  );

describe('Sidebar', () => {
  it('sends the footer card to the signed-in user profile', () => {
    const { container } = renderSidebar({ username: 'n3ptune', avatar: null });

    expect(container.querySelector('.nav-mini').getAttribute('href')).toBe(
      '/users/n3ptune'
    );
  });

  it('links a signed-in member to the terms and the privacy policy', () => {
    renderSidebar({ username: 'n3ptune', avatar: null });

    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      '/terms'
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('shows the picture of a user who has one', () => {
    const { container } = renderSidebar({
      username: 'n3ptune',
      avatar: '/media/avatars/thumbs/abc.webp',
    });

    expect(container.querySelector('.avatar-img').getAttribute('src')).toBe(
      '/media/avatars/thumbs/abc.webp'
    );
  });
});
