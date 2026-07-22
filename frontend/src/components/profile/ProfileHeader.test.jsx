import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ProfileHeader from './ProfileHeader';

// Both are exercised on their own; here they only need to be visible.
vi.mock('./AvatarUpload', () => ({
  default: () => <div>change photo</div>,
}));
vi.mock('./SettingsModal', () => ({
  default: ({ open }) => (open ? <div>settings dialog</div> : null),
}));

const user = {
  username: 'yurii',
  first_name: 'Yurii',
  last_name: 'Koval',
  bio: 'Competitive programmer since 2019.',
  elo_rating: 1850,
  rank: 'Expert',
  maxRating: 1900,
  globalRank: 12,
  joined: '2025-03-01T00:00:00Z',
};

const renderHeader = (props) =>
  render(<ProfileHeader user={user} delta={25} {...props} />);

describe('ProfileHeader', () => {
  it('gives the owner a way to edit the profile and the photo', () => {
    renderHeader({ isOwner: true });

    expect(
      screen.getByRole('button', { name: /edit profile/i })
    ).toBeInTheDocument();
    expect(screen.getByText('change photo')).toBeInTheDocument();
  });

  it('offers a visitor neither of them', () => {
    renderHeader({ isOwner: false });

    // Editing is settled on the backend, which always writes to the caller's
    // own account; hiding these only keeps a stranger from useless controls.
    expect(
      screen.queryByRole('button', { name: /edit profile/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('change photo')).not.toBeInTheDocument();
    // Sharing stays open to everyone.
    expect(
      screen.getByRole('button', { name: /copy profile link/i })
    ).toBeInTheDocument();
  });

  it('opens the settings dialog from the edit button', () => {
    renderHeader({ isOwner: true });

    expect(screen.queryByText('settings dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));

    expect(screen.getByText('settings dialog')).toBeInTheDocument();
  });

  it('prints the full name and bio when they are filled in', () => {
    renderHeader({});

    expect(screen.getByText('Yurii Koval')).toBeInTheDocument();
    expect(
      screen.getByText('Competitive programmer since 2019.')
    ).toBeInTheDocument();
  });

  it('leaves them out entirely when they are empty', () => {
    const { container } = render(
      <ProfileHeader
        user={{ ...user, first_name: '', last_name: '', bio: null }}
        delta={null}
      />
    );

    // Blank slots would make the banner read like an unfinished form.
    expect(container.querySelector('.pname')).toBeNull();
    expect(container.querySelector('.pbio')).toBeNull();
    expect(screen.getByText('yurii')).toBeInTheDocument();
  });
});
