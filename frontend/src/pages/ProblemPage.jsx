import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import SoloTopbar from '../components/problem/SoloTopbar';
import ProblemWorkspace from '../components/problem/ProblemWorkspace';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useProblem } from '../hooks/useProblem';
import { useLanguages } from '../hooks/useLanguages';
import './ProblemPage.css';

// STUB: replaced by GET submissions/?problem=id in plan step 7.
const STUB_SUBMISSIONS = [
  {
    id: 412,
    verdict: 'AC',
    lang: 'Python 3',
    runtime: '88 ms',
    memory: '18 MB',
    when: '2h ago',
  },
  {
    id: 398,
    verdict: 'WA',
    lang: 'Python 3',
    runtime: '61 ms',
    memory: '18 MB',
    when: '3h ago',
  },
  {
    id: 371,
    verdict: 'TLE',
    lang: 'Python 3',
    runtime: '—',
    memory: '—',
    when: '5h ago',
  },
];

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
          submissions={STUB_SUBMISSIONS}
          languages={languages}
          busy={null}
          onSubmit={() => {}} // STUB: wired to POST submissions/ in plan step 8
        />
      ) : (
        <div className="pp-empty">
          {loading || langsLoading ? 'Loading problem…' : 'Problem not found.'}
        </div>
      )}
    </div>
  );
}
