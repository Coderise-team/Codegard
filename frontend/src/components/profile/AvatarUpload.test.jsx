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

  it('turns down an oversized image without spending the upload', async () => {
    const { container } = render(<AvatarUpload />);

    pick(container, imageFile(6 * 1024 * 1024));

    expect(await screen.findByText(/larger than 5 MB/i)).toBeInTheDocument();
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('reports a failed upload and leaves the stored user alone', async () => {
    uploadAvatar.mockRejectedValue(new Error('Network Error'));
    const onUploaded = vi.fn();
    const { container } = render(<AvatarUpload onUploaded={onUploaded} />);

    pick(container, imageFile());

    expect(await screen.findByText(/upload failed/i)).toBeInTheDocument();
    expect(setUser).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
