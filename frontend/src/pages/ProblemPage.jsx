import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import SoloTopbar from '../components/problem/SoloTopbar';
import ProblemWorkspace from '../components/problem/ProblemWorkspace';
import VerdictToast from '../components/problem/VerdictToast';
import NotFoundPage from './NotFoundPage';
import { isNotFound } from '../utils/errors';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useProblem } from '../hooks/useProblem';
import { useLanguages } from '../hooks/useLanguages';
import { useProblemSubmissions } from '../hooks/useProblemSubmissions';
import { useSubmitFlow } from '../hooks/useSubmitFlow';
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
  const { data: problem, loading, error } = useProblem(id);
  const { data: languages, loading: langsLoading } = useLanguages();
  const {
    data: submissions,
    loading: subsLoading,
    reload,
  } = useProblemSubmissions(id);
  const { busy, toast, setToast, submit } = useSubmitFlow(
    (code, language) => ({ problem: Number(id), code, language }),
    reload
  );

  // A problem that isn't there is a 404, not a failure — anything else (server
  // down, connection dropped) has to say so instead of blaming the URL.
  if (isNotFound(error)) {
    return (
      <NotFoundPage
        title="Problem not found"
        sub="This problem does not exist, or the link is out of date."
      />
    );
  }

  // The workspace needs the statement, the language templates and this
  // problem's submissions: the editor starts from the draft, else the latest
  // submission, else the starter code, and it picks them once, on mount. A
  // failed submissions load still opens it, with no submissions.
  const ready = problem && languages?.length && !subsLoading;

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
          key={problem.id}
          problem={problem}
          submissions={submissions ?? []}
          languages={languages}
          busy={busy}
          statusText={busy ? 'Judging…' : undefined}
          onSubmit={submit}
        />
      ) : (
        <div className="pp-empty">
          {loading || langsLoading || subsLoading
            ? 'Loading problem…'
            : 'Could not load the problem. Please try again.'}
        </div>
      )}
      {toast && <VerdictToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
