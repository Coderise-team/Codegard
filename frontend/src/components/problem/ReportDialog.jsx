import { useId, useState } from 'react';
import Modal from '../Modal';
import Icons from '../Icons';
import { reportProblem } from '../../api/problems';
import { useReportReasons } from '../../hooks/useReportReasons';
import { firstError } from '../../utils/errors';
import './ReportDialog.css';

// Match MIN_REPORT_MESSAGE_LENGTH and MAX_REPORT_MESSAGE_LENGTH in the backend
// serializer. The minimum counts the text without surrounding whitespace, the
// same way the backend measures it.
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;

/**
 * ReportDialog — the form for reporting a problem: a reason and a description.
 *
 * Mounted only while it is open, so every report starts from an empty form.
 * Submit stays disabled until a reason is picked and the description is long
 * enough. The backend's own refusals (too many unresolved reports on this
 * problem, too many attempts an hour) come back as `detail` and are shown above
 * the buttons.
 *
 * Props:
 *   problemId — catalog id of the problem being reported
 *   onClose   — close the dialog
 */
export default function ReportDialog({ problemId, onClose }) {
  const reasonsLabelId = useId();
  const { data: reasons, loading, error } = useReportReasons();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit =
    Boolean(reason) && message.trim().length >= MIN_MESSAGE && !busy;

  const onSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await reportProblem(problemId, { reason, message });
      setDone(true);
    } catch (err) {
      const body = err.response?.data;
      setErrors(
        body && typeof body === 'object'
          ? body
          : { form: 'Could not send the report. Please try again.' }
      );
    } finally {
      setBusy(false);
    }
  };

  let content;
  if (done) {
    content = (
      <div className="modal-done">
        <Icons.check size={16} />
        <p>Thanks for the report. We will be sure to review it.</p>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Back to problem
        </button>
      </div>
    );
  } else if (error) {
    content = (
      <div className="modal-form">
        <p className="rd-note">
          The report form could not be loaded. Please try again later.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  } else {
    content = (
      <form className="modal-form" onSubmit={onSubmit} noValidate>
        <div className="modal-field">
          <span className="modal-label" id={reasonsLabelId}>
            Reason
          </span>
          {loading ? (
            <p className="rd-note">Loading…</p>
          ) : (
            <div
              className="rd-options"
              role="radiogroup"
              aria-labelledby={reasonsLabelId}
            >
              {reasons.map((r) => (
                <label key={r.id} className="rd-option">
                  <input
                    type="radio"
                    name="reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          )}
          {errors.reason && (
            <span className="modal-err">{firstError(errors.reason)}</span>
          )}
        </div>

        <label className="modal-field">
          <span className="modal-label">
            Details
            <span className="modal-count">
              {message.length}/{MAX_MESSAGE}
            </span>
          </span>
          <textarea
            className="modal-input modal-textarea scroll"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MAX_MESSAGE}
            rows={5}
            placeholder="What is wrong, and where? A test or a line of the statement helps."
          />
          <span className="rd-hint">At least {MIN_MESSAGE} characters.</span>
          {errors.message && (
            <span className="modal-err">{firstError(errors.message)}</span>
          )}
        </label>

        {errors.detail && <div className="modal-err">{errors.detail}</div>}
        {errors.form && <div className="modal-err">{errors.form}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-sm" disabled={!canSubmit}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <Modal title="Report this problem" onClose={onClose}>
      <div className="modal-body scroll">{content}</div>
    </Modal>
  );
}
