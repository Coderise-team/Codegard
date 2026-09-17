import { useRef, useState } from 'react';
import { updateProfile } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { firstError } from '../../utils/errors';

// Matches MAX_BIO_LENGTH in the backend serializer.
const MAX_BIO = 300;

// Shortest the bio box may be dragged, in pixels.
const MIN_BIO_HEIGHT = 84;

/**
 * ProfileForm — the Settings dialog's Profile tab: full name and bio.
 *
 * Username and email are deliberately absent: the backend refuses to change
 * either, so offering the fields would promise something it won't do.
 *
 * Props:
 *   onSaved — profile was updated (the page reloads it)
 *   onClose — close the dialog
 */
export default function ProfileForm({ onSaved, onClose }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [values, setValues] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    bio: user?.bio ?? '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const bioRef = useRef(null);

  const change = (field) => (event) =>
    setValues((v) => ({ ...v, [field]: event.target.value }));

  // Custom resizing: the native grip only responds in the bottom-right corner
  // and draws a light square that ignores the theme, so it is switched off and
  // the whole bottom edge is made draggable instead.
  const startResize = (event) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = bioRef.current.offsetHeight;

    const onMove = (moveEvent) => {
      const height = startHeight + moveEvent.clientY - startY;
      bioRef.current.style.height = `${Math.max(MIN_BIO_HEIGHT, height)}px`;
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      setUser(await updateProfile(values));
      onSaved?.();
      onClose?.();
    } catch (error) {
      const body = error.response?.data;
      setErrors(
        body && typeof body === 'object'
          ? body
          : { form: 'Could not save your profile. Please try again.' }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={onSubmit} noValidate>
      <div className="sm-row">
        <label className="modal-field">
          <span className="modal-label">First name</span>
          <input
            className="modal-input"
            value={values.first_name}
            onChange={change('first_name')}
            maxLength={150}
            autoComplete="given-name"
          />
          {errors.first_name && (
            <span className="modal-err">{firstError(errors.first_name)}</span>
          )}
        </label>

        <label className="modal-field">
          <span className="modal-label">Last name</span>
          <input
            className="modal-input"
            value={values.last_name}
            onChange={change('last_name')}
            maxLength={150}
            autoComplete="family-name"
          />
          {errors.last_name && (
            <span className="modal-err">{firstError(errors.last_name)}</span>
          )}
        </label>
      </div>

      <label className="modal-field">
        <span className="modal-label">
          Bio
          <span className="modal-count">
            {values.bio.length}/{MAX_BIO}
          </span>
        </span>
        <div className="sm-textwrap">
          <textarea
            ref={bioRef}
            className="modal-input modal-textarea scroll"
            value={values.bio}
            onChange={change('bio')}
            maxLength={MAX_BIO}
            rows={4}
            placeholder="A line or two about yourself"
          />
          <span
            className="sm-grip"
            onPointerDown={startResize}
            aria-hidden="true"
          />
        </div>
        {errors.bio && (
          <span className="modal-err">{firstError(errors.bio)}</span>
        )}
      </label>

      {errors.form && <div className="modal-err">{errors.form}</div>}

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
