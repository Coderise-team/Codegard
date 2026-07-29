import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Icons from '../components/Icons';
import ContestBanner from '../components/contests/ContestBanner';
import ContestAside from '../components/contests/ContestAside';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useContest, contestState } from '../hooks/useContest';
import { useContestPanel } from '../hooks/useContestPanel';
import { useMyStanding } from '../hooks/useMyStanding';
import { useLeaderboardSignal } from '../hooks/useLeaderboardSignal';
import { useThrottledSignal } from '../hooks/useThrottledSignal';
import { joinContest, leaveContest } from '../api/contests';
import { indexToLetter } from '../utils/contestLetters';
import {
  formatDuration,
  formatFullDate,
  formatTimeOfDay,
  timeAgo,
} from '../utils/time';
import './ContestPage.css';

/**
 * ContestPage — a single-contest event page (compact density, violet accent).
 *
 * The main stage is one full-bleed violet gradient banner: badge, title,
 * meta, live/soon/finished countdown, a primary CTA, and the A–E problem
 * strip. A collapsible right aside shows registrants (upcoming) or the
 * standings (live / finished).
 *
 * Fully server-driven: detail + my-standing + join for the banner, paginated
 * registrants / leaderboard slices for the aside (useContestPanel).
 */
export default function ContestPage() {
  const { id } = useParams();
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);
  const [showPanel, setShowPanel] = useState(true);

  const { contest, loading, error, reload } = useContest(id);

  // A ticking clock kept in state and passed down — the React Compiler caches
  // anything that reads Date.now() in render, so the time must be a prop that
  // changes each second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = contest ? contestState(contest, now) : null;

  // A detail fetched before the start has its problems hidden by the backend.
  // The instant the clock flips the contest live, refetch so the real problem
  // list replaces the locked placeholders. Adjust-during-render.
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    if (prevState === 'soon' && state === 'live') reload();
  }

  // Live standings: open the contest channel while the panel is open and the
  // round is live or finished. Collapsed -> no socket, so no refetch (that is
  // "don't update while collapsed", for free). It stays open through the
  // finished window on purpose: ELO is applied ~a minute after the end, and
  // `contest_ended` (which the server sends once, after rating, then closes) is
  // how the deltas get pulled in without a manual refresh — the hook stops
  // reconnecting on its own once that arrives. Variant B: the socket only
  // signals; a paced signal (throttle + jitter) refetches over HTTP.
  const { signal, ended } = useLeaderboardSignal(
    id,
    showPanel && (state === 'live' || state === 'finished')
  );
  const paced = useThrottledSignal(signal);

  const standing = useMyStanding(
    id,
    state === 'live' || state === 'finished',
    paced
  );

  // The side panel slice: who registered before the start, the standings
  // during and after. Pages are appended as the panel scrolls.
  const kind =
    state == null ? null : state === 'soon' ? 'registrants' : 'leaderboard';
  const panel = useContestPanel(id, kind);

  // A paced bump means the standings changed — refetch every loaded page in
  // place, so a viewer scrolled down the list is refreshed where they are
  // instead of being thrown back to the top.
  const { reloadLoaded } = panel;
  useEffect(() => {
    if (paced) reloadLoaded();
  }, [paced, reloadLoaded]);

  // The round closed: the server applied ELO and sent contest_ended, so pull
  // the final standings once more to show the rating deltas that just landed.
  useEffect(() => {
    if (ended) reloadLoaded();
  }, [ended, reloadLoaded]);

  // Optimistic registration: flip locally, call the API, revert on failure.
  // The participants count follows the flip (±1 against the server value).
  const [regOverride, setRegOverride] = useState(null);

  // Adjust-during-render: a flip made on one contest must not leak into
  // another when only the :id param changes (the component isn't remounted).
  const [prevId, setPrevId] = useState(id);
  if (prevId !== id) {
    setPrevId(id);
    setRegOverride(null);
  }

  const serverJoined = contest?.is_joined ?? false;
  const registered = regOverride ?? serverJoined;
  const countDelta = registered === serverJoined ? 0 : registered ? 1 : -1;
  const toggleReg = async () => {
    const joined = registered;
    setRegOverride(!joined);
    try {
      await (joined ? leaveContest(id) : joinContest(id));
      panel.reload();
    } catch {
      setRegOverride(joined);
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
      registeredCount: contest.participants_count + countDelta,
      endedAgo: state === 'finished' ? timeAgo(contest.end_time, now) : null,
    },
    // Before the start the backend hides the problems (problems: []) — the
    // locked pips are drawn from the count alone.
    problems:
      state === 'soon'
        ? Array.from({ length: contest.problems_count }, (_, i) => ({
            id: indexToLetter(i),
          }))
        : contest.problems.map((p, i) => ({
            id: indexToLetter(i),
            title: p.title,
            solvedBy: p.solved_count,
          })),
    yourProbs: { live: statuses, finished: statuses },
  };

  const crumb = (
    <span className="cp-crumb">
      <Icons.trophy size={16} />
      <Link className="cp-crumb-link" to="/contests">
        Contests
      </Link>
      <span className="dim">&nbsp;/</span> {contest?.title ?? '…'}
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
                contestId={id}
                state={state}
                seconds={seconds}
                registered={registered}
                onToggle={toggleReg}
              />
              <ContestAside
                state={state}
                open={showPanel}
                onToggle={() => setShowPanel((v) => !v)}
                panel={panel}
                problemsCount={contest.problems_count}
                you={user?.username}
                myStanding={standing}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
