import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import SoloTopbar from '../components/problem/SoloTopbar';
import ProblemWorkspace from '../components/problem/ProblemWorkspace';
import VerdictToast from '../components/problem/VerdictToast';
import { createSubmission, getSubmission } from '../api/submissions';
import { waitForVerdict } from '../api/verdict';
import { toastFor } from '../utils/submissionToast';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useProblem } from '../hooks/useProblem';
import { useLanguages } from '../hooks/useLanguages';
import { useProblemSubmissions } from '../hooks/useProblemSubmissions';
import './ProblemPage.css';

/**
 * ProblemPage — solo problem solving at /problems/:id.
 * Composes the mode-agnostic ProblemWorkspace with the solo topbar; the
 * shared Sidebar is an off-canvas drawer here (burger in the topbar).
 */
export default function ProblemPage() {
  const { id } = useParams();
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);
  const { data: problem, loading } = useProblem(id);
  const { data: languages, loading: langsLoading } = useLanguages();
  const { data: submissions, reload } = useProblemSubmissions(id);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  const handleSubmit = async (code, language) => {
    setBusy('submit');
    setToast(null);

    let created;
    try {
      created = await createSubmission({ problem: Number(id), code, language });
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
      reload();
      return;
    }

    reload(); // the new row shows up as Pending right away
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
      reload();
    }
  };

  // The workspace needs both the statement and the language templates
  // (the editor starts from the selected language's starter code).
  const ready = problem && languages?.length;

  return (
    <div className="pp-app" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />
      <SoloTopbar
        title={problem?.title ?? ''}
        user={user}
        onMenuClick={() => setNavOpen(true)}
      />
      {ready ? (
        <ProblemWorkspace
          problem={problem}
          submissions={submissions ?? []}
          languages={languages}
          busy={busy}
          statusText={busy ? 'Judging…' : undefined}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="pp-empty">
          {loading || langsLoading ? 'Loading problem…' : 'Problem not found.'}
        </div>
      )}
      {toast && <VerdictToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
