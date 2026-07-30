import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import ContestTopbar from '../components/problem/ContestTopbar';
import ProblemWorkspace from '../components/problem/ProblemWorkspace';
import VerdictToast from '../components/problem/VerdictToast';
import NotFoundPage from './NotFoundPage';
import ContestLeaderboard from '../components/problem/ContestLeaderboard';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useContestProblem } from '../hooks/useContestProblem';
import { contestState } from '../hooks/useContest';
import { useLanguages } from '../hooks/useLanguages';
import { useProblemSubmissions } from '../hooks/useProblemSubmissions';
import { useSubmitFlow } from '../hooks/useSubmitFlow';
import { useContestPanel } from '../hooks/useContestPanel';
import { useMyStanding } from '../hooks/useMyStanding';
import { useLeaderboardSignal } from '../hooks/useLeaderboardSignal';
import { useThrottledSignal } from '../hooks/useThrottledSignal';
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
  // Standings live in a rail toggled from the topbar; hidden by default so the
  // editor gets the full width until the solver asks for the board.
  const [showLb, setShowLb] = useState(false);
  // Bumped after a submission lands, so my-standing refetches — this is what
  // turns the topbar problem dots green the moment a solve is judged.
  const [afterSubmit, setAfterSubmit] = useState(0);

  const { contest, problem, loading, notFound } = useContestProblem(id, letter);
  const { data: languages, loading: langsLoading } = useLanguages();
  // Scope submissions to this round — the contest workspace must not surface
  // training attempts at the same problem.
  const { data: submissions, reload } = useProblemSubmissions(
    problem?.id,
    Number(id)
  );

  // Same submit -> judge -> toast flow as the solo page, but the attempt is
  // filed against the round, so it counts toward the standings and rating.
  const { busy, toast, setToast, submit } = useSubmitFlow(
    (code, language) => ({
      problem: problem?.id,
      contest: Number(id),
      code,
      language,
    }),
    () => {
      reload();
      setAfterSubmit((k) => k + 1);
    }
  );

  // The topbar countdown ticks off a clock kept in state (the React Compiler
  // caches a render-time Date.now(), so the timer would otherwise freeze).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // The backend only accepts submissions while the round is active; mirror that
  // in the UI (disabled Submit with a reason) and drive the live channel — the
  // socket is only worth opening while the standings can still change.
  const isLive = contest ? contestState(contest, now) === 'live' : false;

  // Live standings for the rail: the socket only signals that something changed
  // (variant B), so a paced signal (throttle + jitter) triggers a refetch of
  // the top slice and my own row through the ordinary HTTP endpoints. All of it
  // is gated on `showLb` — a collapsed rail opens no socket and fetches nothing.
  const { signal } = useLeaderboardSignal(id, showLb && isLive);
  const paced = useThrottledSignal(signal);
  const panel = useContestPanel(id, showLb ? 'leaderboard' : null);
  const { reload: reloadPanel } = panel;

  // A live tick refreshes the standings list (rail).
  useEffect(() => {
    if (paced) reloadPanel();
  }, [paced, reloadPanel]);

  // my-standing drives the topbar dots, so it loads whenever the round does —
  // independent of whether the rail is open. It refetches on a live tick
  // (`paced`) and right after a submission (`afterSubmit`).
  const myStanding = useMyStanding(
    id,
    Boolean(contest),
    `${paced}:${afterSubmit}`
  );
  const statusById = Object.fromEntries(
    (myStanding?.problems ?? []).map((p) => [p.id, p.status])
  );

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

  // Solving is for registered participants. A non-participant is in the wrong
  // place — send them to the contest page, which is where they register and
  // where the solo catalogue (/problems/:id) is one click away for upsolving.
  if (contest && !contest.is_joined) {
    return <Navigate to={`/contests/${id}`} replace />;
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
          statuses={statusById}
          showLeaderboard={showLb}
          onToggleLeaderboard={() => setShowLb((v) => !v)}
          onMenuClick={() => setNavOpen(true)}
        />
      )}
      {ready ? (
        <ProblemWorkspace
          problem={problem}
          submissions={submissions ?? []}
          languages={languages}
          busy={busy}
          canSubmit={isLive}
          statusText={
            !isLive ? 'Contest has ended' : busy ? 'Judging…' : undefined
          }
          onSubmit={submit}
          rail={
            showLb ? (
              <ContestLeaderboard
                live={isLive}
                panel={panel}
                problemsCount={contest.problems.length}
                you={user?.username}
                myStanding={myStanding}
              />
            ) : null
          }
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
