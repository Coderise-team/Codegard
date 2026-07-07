import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import SoloTopbar from '../components/problem/SoloTopbar';
import ProblemWorkspace from '../components/problem/ProblemWorkspace';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useProblem } from '../hooks/useProblem';
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

// STUB: starter template comes from GET languages/ in plan step 6.
const STUB_STARTER =
  'import sys\n\ndata = sys.stdin.read().split()\n# your code here\n';

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

  return (
    <div className="pp-app" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />
      <SoloTopbar
        title={problem?.title ?? ''}
        user={user}
        onMenuClick={() => setNavOpen(true)}
      />
      {problem ? (
        <ProblemWorkspace
          problem={problem}
          submissions={STUB_SUBMISSIONS}
          starterCode={STUB_STARTER}
          busy={null}
          statusText="Python 3 · ready"
          onSubmit={() => {}} // STUB: wired to POST submissions/ in plan step 8
        />
      ) : (
        <div className="pp-empty">
          {loading ? 'Loading problem…' : 'Problem not found.'}
        </div>
      )}
    </div>
  );
}
