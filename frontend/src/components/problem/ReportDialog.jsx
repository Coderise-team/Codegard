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

// What is still missing before the report can go out, keyed like the
// backend's field errors. The maximum needs no check: the field's maxLength
// cuts typed and pasted text alike.
const checkReport = (reason, message) => {
  const missing = {};
  if (!reason) missing.reason = 'Choose a reason.';
  if (message.trim().length < MIN_MESSAGE)
    missing.message = `Describe the issue in at least ${MIN_MESSAGE} characters.`;
  return missing;
};

/**
 * ReportDialog — the form for reporting a problem: a reason and a description.
 *
 * Mounted only while it is open, so every report starts from an empty form.
 * Send report is always clickable: a first press with something missing sends
 * nothing and names what is missing under each field, and from then on those
 * messages follow the fields as they are fixed. The backend's own refusals
 * (too many unresolved reports on this problem, too many attempts an hour)
 * come back as `detail` and are shown above the buttons.
 *
 * Props:
 *   problemId — catalog id of the problem being reported
 *   contestId — the round the report is filed from; absent in the catalog
 *   onClose   — close the dialog
 */
export default function ReportDialog({ problemId, contestId, onClose }) {
  const reasonsLabelId = useId();
  const { data: reasons, loading, error } = useReportReasons();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const missing = tried ? checkReport(reason, message) : {};
  const reasonError = missing.reason ?? firstError(serverErrors.reason);
  const messageError = missing.message ?? firstError(serverErrors.message);

  const onSubmit = async (event) => {
    event.preventDefault();
    setTried(true);
    setServerErrors({});
    if (Object.keys(checkReport(reason, message)).length) return;

    setBusy(true);
    try {
      const body = { reason, message };
      if (contestId) body.contest = contestId;
      await reportProblem(problemId, body);
      setDone(true);
    } catch (err) {
      const body = err.response?.data;
      setServerErrors(
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
        <Icons.check size={24} />
        <p>Thanks for the report. We will be sure to review it.</p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
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
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  } else {
    content = (
      <form className="modal-form" onSubmit={onSubmit} noValidate>
        <p className="rd-intro">
          Spotted something wrong with this problem? Tell us what happened and
          we&apos;ll look into it as soon as we can. Pick a reason and describe
          what went wrong.
        </p>

        <div className="modal-field">
          <span className="modal-label" id={reasonsLabelId}>
            <span>
              Reason{' '}
              <span className="modal-required" aria-hidden="true">
                *
              </span>
            </span>
          </span>
          {loading ? (
            <p className="rd-note">Loading…</p>
          ) : (
            <div
              className="rd-options"
              role="radiogroup"
              aria-labelledby={reasonsLabelId}
              aria-required="true"
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
          {reasonError && <span className="modal-err">{reasonError}</span>}
        </div>

        <label className="modal-field">
          <span className="modal-label">
            <span>
              Details{' '}
              <span className="modal-required" aria-hidden="true">
                *
              </span>
            </span>
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
            aria-required="true"
            placeholder="What is wrong, and where? A test or a line of the statement helps."
          />
          {messageError ? (
            <span className="modal-err">{messageError}</span>
          ) : (
            <span className="rd-hint">At least {MIN_MESSAGE} characters.</span>
          )}
        </label>

        {serverErrors.detail && (
          <div className="modal-err">{serverErrors.detail}</div>
        )}
        {serverErrors.form && (
          <div className="modal-err">{serverErrors.form}</div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || loading}
          >
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
