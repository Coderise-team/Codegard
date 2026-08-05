import { useRef, useState } from 'react';
import Icons from '../Icons';
import { uploadAvatar } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

// Mirrors the backend limits so an oversized or non-image file is rejected
// before it is uploaded; the backend enforces them again on arrival.
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * AvatarUpload — camera button laid over the profile avatar, shown to the owner
 * only. Clicking it opens the file picker and uploads the chosen image.
 *
 * Props:
 *   onUploaded — a new picture is stored, so the profile should be reloaded.
 *     The shell (sidebar, topbar) picks it up from the auth store on its own,
 *     but the banner draws whatever the profile request returned, and that
 *     answer is now out of date.
 */
export default function AvatarUpload({ onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const setUser = useAuthStore((s) => s.setUser);

  const onPick = async (event) => {
    const file = event.target.files?.[0];
    // Reset at once: picking the same file twice in a row fires no change event
    // otherwise, so a retry after an error would look dead.
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      setError('Image is larger than 5 MB.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { avatar } = await uploadAvatar(file);
      setUser({ avatar });
      onUploaded?.();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="avatar-cam"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Change photo"
        aria-label="Change photo"
      >
        <Icons.camera size={15} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        hidden
        onChange={onPick}
      />
      {(busy || error) && (
        <div className={`avatar-note${error ? ' is-error' : ''}`} role="status">
          {error ?? 'Uploading…'}
        </div>
      )}
    </>
  );
}
