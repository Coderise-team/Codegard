import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { useCurrentUser } from '../hooks/useCurrentUser';
import './ContestProblemPage.css';

/**
 * ContestProblemPage — solving a problem inside a contest at
 * /contests/:id/problems/:letter.
 *
 * Reuses the same mode-agnostic ProblemWorkspace as the solo page, wrapped in
 * contest chrome instead: the round timer, the problem strip and the live
 * standings in the workspace rail.
 *
 * The URL carries the round letter, not the problem id (the way Codeforces
 * does it): it matches what the round shows on screen, and it keeps the
 * catalogue id — and with it the shortcut to the public problem page — out of
 * the address bar.
 */
export default function ContestProblemPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="cpp-app">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="cpp-empty">Loading problem…</div>
    </div>
  );
}
