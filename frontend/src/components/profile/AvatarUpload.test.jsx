import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import AvatarUpload from './AvatarUpload';

const { uploadAvatar, setUser } = vi.hoisted(() => ({
  uploadAvatar: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock('../../api/auth', () => ({ uploadAvatar }));
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) => selector({ setUser }),
}));

const imageFile = (size) => {
  const file = new File(['data'], 'me.png', { type: 'image/png' });
  if (size) Object.defineProperty(file, 'size', { value: size });
  return file;
};

const pick = (container, file) =>
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [file] },
  });

beforeEach(() => {
  vi.clearAllMocks();
  uploadAvatar.mockResolvedValue({ avatar: '/media/avatars/abc.webp' });
});

describe('AvatarUpload', () => {
  it('uploads the picked image and keeps the stored user in step', async () => {
    const onUploaded = vi.fn();
    const { container } = render(<AvatarUpload onUploaded={onUploaded} />);
    const file = imageFile();

    pick(container, file);

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith(file));
    expect(setUser).toHaveBeenCalledWith({ avatar: '/media/avatars/abc.webp' });
    // The banner still shows the picture the profile request returned, so it
    // has to be asked again.
    expect(onUploaded).toHaveBeenCalled();
  });

  it('covers the avatar while the upload is in flight', async () => {
    let finish;
    uploadAvatar.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { container } = render(<AvatarUpload />);

    pick(container, imageFile());

    // The wording is what a screen reader announces; the veil and spinner are
    // the same news for everyone else.
    expect(await screen.findByText('Uploading…')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /change photo/i })
    ).toBeDisabled();

    finish({ avatar: '/media/avatars/thumbs/abc.webp' });

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('turns down an oversized image without spending the upload', async () => {
    const { container } = render(<AvatarUpload />);

    pick(container, imageFile(6 * 1024 * 1024));

    expect(await screen.findByText(/larger than 5 MB/i)).toBeInTheDocument();
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('lets the error card be dismissed by hand', async () => {
    const { container } = render(<AvatarUpload />);

    pick(container, imageFile(6 * 1024 * 1024));
    const card = await screen.findByText(/larger than 5 MB/i);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(card).not.toBeInTheDocument();
  });

  it('says the server is out of reach when nothing answered', async () => {
    // An axios error from a dropped connection carries no response at all.
    uploadAvatar.mockRejectedValue(new Error('Network Error'));
    const onUploaded = vi.fn();
    const { container } = render(<AvatarUpload onUploaded={onUploaded} />);

    pick(container, imageFile());

    expect(
      await screen.findByText(/check your connection/i)
    ).toBeInTheDocument();
    expect(setUser).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('repeats the reason the server gave for turning the file down', async () => {
    uploadAvatar.mockRejectedValue({
      response: { data: { avatar: ['Upload a valid image.'] } },
    });
    const { container } = render(<AvatarUpload />);

    pick(container, imageFile());

    // "Try again" is useless advice for a file that will never be an image.
    expect(
      await screen.findByText('Upload a valid image.')
    ).toBeInTheDocument();
  });
});
