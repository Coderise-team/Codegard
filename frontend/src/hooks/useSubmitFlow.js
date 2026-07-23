import { useState } from 'react';
import { createSubmission, getSubmission } from '../api/submissions';
import { waitForVerdict } from '../api/verdict';
import { toastFor } from '../utils/submissionToast';

/**
 * Drives the submit -> judge -> verdict toast flow shared by the solo and
 * contest problem pages. The two differ only in the request body, so the caller
 * passes `buildPayload(code, language)` returning the createSubmission args
 * (solo sends a bare problem; contest adds the round id). `onSettled` refetches
 * the submissions list so the new row shows up Pending and again with its
 * verdict.
 *
 * Returns { busy, toast, setToast, submit }: `busy` is 'submit' while a
 * solution is in flight, `toast` is the current VerdictToast content (null when
 * hidden), and `submit` is the ProblemWorkspace onSubmit handler.
 */
export function useSubmitFlow(buildPayload, onSettled) {
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  const submit = async (code, language) => {
    setBusy('submit');
    setToast(null);

    let created;
    try {
      created = await createSubmission(buildPayload(code, language));
    } catch {
      setBusy(null);
      setToast({
        label: 'Submission failed',
        detail: 'Could not send your solution — please try again.',
      });
      return;
    }
    if (created.status !== 'queued') {
      setBusy(null);
      setToast({
        label: 'Submission failed',
        detail: 'The judge queue is unavailable — please try again later.',
      });
      onSettled();
      return;
    }

    onSettled(); // the new row shows up as Pending right away
    try {
      await waitForVerdict(created.id);
      const judged = await getSubmission(created.id);
      setToast(toastFor(judged));
    } catch {
      setToast({
        label: 'Still judging…',
        detail: 'The verdict will appear in the Submissions tab.',
      });
    } finally {
      setBusy(null);
      onSettled();
    }
  };

  return { busy, toast, setToast, submit };
}
