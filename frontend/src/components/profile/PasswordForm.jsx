import { useState } from 'react';
import Icons from '../Icons';
import { changePassword } from '../../api/auth';
import { tokenStorage } from '../../api/client';
import { firstError } from '../../utils/errors';

// Django's password validators report every rule that failed at once, all of
// them under non_field_errors, so they are listed rather than reduced to one.
const asList = (value) => (Array.isArray(value) ? value : [value]);

/**
 * PasswordForm — the Settings dialog's Password tab.
 *
 * A successful change revokes every refresh token the account had and answers
 * with a fresh pair, which is stored right away: skip that and the session
 * would die at the next token refresh.
 *
 * Props:
 *   onClose — close the dialog
 */
export default function PasswordForm({ onClose }) {
  const [values, setValues] = useState({
    old_password: '',
    new_password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const change = (field) => (event) =>
    setValues((v) => ({ ...v, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    if (values.new_password !== values.confirm) {
      setErrors({ confirm: 'The two passwords do not match.' });
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      tokenStorage.set(
        await changePassword({
          old_password: values.old_password,
          new_password: values.new_password,
        })
      );
      setDone(true);
    } catch (error) {
      const body = error.response?.data;
      setErrors(
        body && typeof body === 'object'
          ? body
          : { form: 'Could not change your password. Please try again.' }
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="modal-done">
        <Icons.check size={24} />
        <p>
          Your password has been changed. Any other device signed in to this
          account has been logged out.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form className="modal-form" onSubmit={onSubmit} noValidate>
      <label className="modal-field">
        <span className="modal-label">Current password</span>
        <input
          type="password"
          className="modal-input"
          value={values.old_password}
          onChange={change('old_password')}
          autoComplete="current-password"
        />
        {errors.old_password && (
          <span className="modal-err">{firstError(errors.old_password)}</span>
        )}
      </label>

      <label className="modal-field">
        <span className="modal-label">New password</span>
        <input
          type="password"
          className="modal-input"
          value={values.new_password}
          onChange={change('new_password')}
          autoComplete="new-password"
        />
        {errors.new_password && (
          <span className="modal-err">{firstError(errors.new_password)}</span>
        )}
      </label>

      <label className="modal-field">
        <span className="modal-label">Confirm new password</span>
        <input
          type="password"
          className="modal-input"
          value={values.confirm}
          onChange={change('confirm')}
          autoComplete="new-password"
        />
        {errors.confirm && <span className="modal-err">{errors.confirm}</span>}
      </label>

      {errors.non_field_errors &&
        asList(errors.non_field_errors).map((message) => (
          <div className="modal-err" key={message}>
            {message}
          </div>
        ))}
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
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
