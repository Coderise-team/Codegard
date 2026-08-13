import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icons from '../Icons';
import { uploadAvatar } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import './AvatarUpload.css';

// Mirrors the backend limits so an oversized or non-image file is rejected
// before it is uploaded; the backend enforces them again on arrival.
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif';

// How long an error card stays up before it fades on its own.
const ERROR_VISIBLE_MS = 5000;

/**
 * Turn a failed upload into something worth reading.
 *
 * The endpoint names the real reason (not an image, unsupported type, too
 * large) under the `avatar` field, and that reason decides what the owner
 * should do next — picking a different file, or simply trying again. Only a
 * connection that never reached the server earns "try again".
 */
function uploadErrorText(error) {
  if (!error?.response) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  const body = error.response.data;
  const reason = body?.avatar ?? body?.detail;
  const text = (Array.isArray(reason) ? reason : [reason])
    .filter(Boolean)
    .map(String)
    .join(' ');
  return text || 'Upload failed. Please try again.';
}

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
  // An object, not a bare string: two identical failures in a row have to count
  // as two events, or the second one would inherit the first one's dying timer.
  const [error, setError] = useState(null);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(null), ERROR_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const onPick = async (event) => {
    const file = event.target.files?.[0];
    // Reset at once: picking the same file twice in a row fires no change event
    // otherwise, so a retry after an error would look dead.
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      setError({ text: 'Image is larger than 5 MB.' });
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { avatar } = await uploadAvatar(file);
      setUser({ avatar });
      onUploaded?.();
    } catch (failure) {
      setError({ text: uploadErrorText(failure) });
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
      {busy && (
        <div className="avatar-busy" role="status">
          <span className="spin" />
          {/* Read out loud: a live region announces its text, and a spinner
              has none. */}
          <span className="sr-only">Uploading…</span>
        </div>
      )}
      {error &&
        createPortal(
          <div className="avatar-toast-wrap">
            <div className="avatar-toast" role="alert">
              <div className="avatar-toast-icon">
                <Icons.xBold size={18} />
              </div>
              <div className="avatar-toast-text">{error.text}</div>
              <button
                type="button"
                className="icon-btn avatar-toast-close"
                onClick={() => setError(null)}
                aria-label="Dismiss"
              >
                <Icons.x size={14} />
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
