import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Avatar from './Avatar';

const picture = (container) => container.querySelector('.avatar-img');

describe('Avatar', () => {
  it('draws the picture when the user has one', () => {
    const { container } = render(
      <Avatar src="/media/avatars/thumbs/abc.webp" username="n3ptune" />
    );

    expect(picture(container).getAttribute('src')).toBe(
      '/media/avatars/thumbs/abc.webp'
    );
    // The badge stays underneath, so a slow load never shows an empty square.
    expect(screen.getByText('N3')).toBeInTheDocument();
  });

  it('shows only the initials when there is no avatar', () => {
    const { container } = render(<Avatar src={null} username="alice" />);

    expect(picture(container)).toBeNull();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('drops a picture that fails to load', () => {
    const { container } = render(<Avatar src="/gone.webp" username="alice" />);

    fireEvent.error(picture(container));

    // Falling back to the badge beats a browser's broken-image icon.
    expect(picture(container)).toBeNull();
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('gives a freshly uploaded picture its own chance', () => {
    const { container, rerender } = render(
      <Avatar src="/gone.webp" username="alice" />
    );
    fireEvent.error(picture(container));

    rerender(<Avatar src="/media/avatars/thumbs/new.webp" username="alice" />);

    // A new upload means a new url; the previous failure must not stick to it.
    expect(picture(container).getAttribute('src')).toBe(
      '/media/avatars/thumbs/new.webp'
    );
  });

  it('keeps the caller box class and draws what it is given', () => {
    const { container } = render(
      <Avatar src={null} username="alice" className="pavatar">
        <button type="button">change photo</button>
      </Avatar>
    );

    // Size and shape belong to the caller, extras (the camera button) stay on top.
    expect(container.querySelector('.pavatar.avatar-box')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /change photo/i })
    ).toBeInTheDocument();
  });
});
