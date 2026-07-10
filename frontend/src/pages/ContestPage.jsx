import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Icons from '../components/Icons';
import ContestBanner from '../components/contests/ContestBanner';
import ContestAside from '../components/contests/ContestAside';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useContest, contestState } from '../hooks/useContest';
import { useMyStanding } from '../hooks/useMyStanding';
import { joinContest } from '../api/contests';
import { formatDuration, formatFullDate, formatTimeOfDay } from '../utils/time';
import contestData from '../data/contestData';
import './ContestPage.css';

// Contest problems are labelled by position: A, B, C, …
const pip = (i) => String.fromCharCode(65 + i);

/**
 * ContestPage — a single-contest event page (compact density, violet accent).
 *
 * The main stage is one full-bleed violet gradient banner: badge, title,
 * meta, live/soon/finished countdown, a primary CTA, and the A–E problem
 * strip. A collapsible right aside shows registrants (upcoming) or the
 * standings (live / finished).
 *
 * The banner runs on the real API (detail + my-standing + join); the aside
 * rows are still baked-in until the registrants/leaderboard endpoints land.
 */
export default function ContestPage() {
  const { id } = useParams();
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);
  const [showPanel, setShowPanel] = useState(true);

  const { contest, loading, error } = useContest(id);

  // A ticking clock kept in state and passed down — the React Compiler caches
  // anything that reads Date.now() in render, so the time must be a prop that
  // changes each second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = contest ? contestState(contest, now) : null;
  const standing = useMyStanding(id, state === 'live' || state === 'finished');

  // Optimistic registration: flip locally, call the API, revert on failure.
  const [regOverride, setRegOverride] = useState(null);
  const registered = regOverride ?? contest?.is_joined ?? false;
  const register = async () => {
    setRegOverride(true);
    try {
      await joinContest(id);
    } catch {
      setRegOverride(null);
    }
  };

  const endsAt = state === 'soon' ? contest?.start_time : contest?.end_time;
  const seconds = contest
    ? Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000))
    : 0;

  const statusById = Object.fromEntries(
    (standing?.problems ?? []).map((p) => [p.id, p.status])
  );
  const statuses = (contest?.problems ?? []).map(
    (p) => statusById[p.id] || 'open'
  );

  const D = contest && {
    contest: {
      name: contest.title,
      date: formatFullDate(contest.start_time),
      time: formatTimeOfDay(contest.start_time),
      duration: formatDuration(contest.start_time, contest.end_time),
      registeredCount: contest.participants_count,
    },
    problems: contest.problems.map((p, i) => ({
      id: pip(i),
      title: p.title,
      solvedBy: null,
    })),
    yourProbs: { live: statuses, finished: statuses },
    // Baked-in rows until the registrants/leaderboard endpoints land.
    registrants: contestData.registrants,
    standings: contestData.standings,
    finalStandings: contestData.finalStandings,
  };

  const crumb = (
    <span className="cp-crumb">
      <Icons.trophy size={16} />
      <span className="dim">Contests&nbsp;/</span> {contest?.title ?? '…'}
    </span>
  );

  return (
    <div className="dash" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
          title={crumb}
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="cp-stage">
          {loading ? (
            <div className="list-msg">Loading…</div>
          ) : error || !contest ? (
            <div className="list-msg">Couldn’t load the contest.</div>
          ) : (
            <>
              <ContestBanner
                D={D}
                state={state}
                seconds={seconds}
                registered={registered}
                onRegister={register}
              />
              <ContestAside
                D={D}
                state={state}
                open={showPanel}
                onToggle={() => setShowPanel((v) => !v)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
