import { useState } from 'react';
import { updateProfile } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

// Matches MAX_BIO_LENGTH in the backend serializer.
const MAX_BIO = 300;

// DRF reports field errors as a list of messages; only the first is shown.
const firstError = (value) => (Array.isArray(value) ? value[0] : value);

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

  const change = (field) => (event) =>
    setValues((v) => ({ ...v, [field]: event.target.value }));

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
    <form className="sm-form" onSubmit={onSubmit} noValidate>
      <div className="sm-row">
        <label className="sm-field">
          <span className="sm-label">First name</span>
          <input
            className="sm-input"
            value={values.first_name}
            onChange={change('first_name')}
            maxLength={150}
            autoComplete="given-name"
          />
          {errors.first_name && (
            <span className="sm-err">{firstError(errors.first_name)}</span>
          )}
        </label>

        <label className="sm-field">
          <span className="sm-label">Last name</span>
          <input
            className="sm-input"
            value={values.last_name}
            onChange={change('last_name')}
            maxLength={150}
            autoComplete="family-name"
          />
          {errors.last_name && (
            <span className="sm-err">{firstError(errors.last_name)}</span>
          )}
        </label>
      </div>

      <label className="sm-field">
        <span className="sm-label">
          Bio
          <span className="sm-count">
            {values.bio.length}/{MAX_BIO}
          </span>
        </span>
        <textarea
          className="sm-input sm-textarea"
          value={values.bio}
          onChange={change('bio')}
          maxLength={MAX_BIO}
          rows={4}
          placeholder="A line or two about yourself"
        />
        {errors.bio && <span className="sm-err">{firstError(errors.bio)}</span>}
      </label>

      {errors.form && <div className="sm-err">{errors.form}</div>}

      <div className="sm-actions">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
