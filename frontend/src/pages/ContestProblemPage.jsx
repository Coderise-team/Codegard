import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import ContestTopbar from '../components/problem/ContestTopbar';
import ProblemWorkspace from '../components/problem/ProblemWorkspace';
import VerdictToast from '../components/problem/VerdictToast';
import NotFoundPage from './NotFoundPage';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useContestProblem } from '../hooks/useContestProblem';
import { useLanguages } from '../hooks/useLanguages';
import { useProblemSubmissions } from '../hooks/useProblemSubmissions';
import { useSubmitFlow } from '../hooks/useSubmitFlow';
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
  const { id, letter } = useParams();
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  const { contest, problem, loading, notFound } = useContestProblem(id, letter);
  const { data: languages, loading: langsLoading } = useLanguages();
  const { data: submissions, reload } = useProblemSubmissions(problem?.id);

  // Same submit -> judge -> toast flow as the solo page, but the attempt is
  // filed against the round, so it counts toward the standings and rating.
  const { busy, toast, setToast, submit } = useSubmitFlow(
    (code, language) => ({
      problem: problem.id,
      contest: Number(id),
      code,
      language,
    }),
    reload
  );

  // The topbar countdown ticks off a clock kept in state (the React Compiler
  // caches a render-time Date.now(), so the timer would otherwise freeze).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // An unknown round, an unknown letter and a letter past the end of the round
  // are all "this URL addresses nothing" — anything else (server down, dropped
  // connection) has to say so instead of blaming the URL.
  if (notFound) {
    return (
      <NotFoundPage
        title="Problem not found"
        sub="This contest problem does not exist, or the link is out of date."
      />
    );
  }

  // The workspace needs both the statement and the language templates (the
  // editor starts from the selected language's starter code).
  const ready = problem && languages?.length;

  return (
    <div className="cpp-app">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />
      {contest && (
        <ContestTopbar
          contest={contest}
          currentLetter={letter}
          now={now}
          user={user}
          onMenuClick={() => setNavOpen(true)}
        />
      )}
      {ready ? (
        <ProblemWorkspace
          problem={problem}
          submissions={submissions ?? []}
          languages={languages}
          busy={busy}
          statusText={busy ? 'Judging…' : undefined}
          onSubmit={submit}
        />
      ) : (
        <div className="cpp-empty">
          {loading || langsLoading
            ? 'Loading problem…'
            : 'Could not load the problem. Please try again.'}
        </div>
      )}
      {toast && <VerdictToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
