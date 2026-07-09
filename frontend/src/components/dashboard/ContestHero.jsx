import { useEffect, useState } from 'react';
import Icons from '../Icons';
import { useContestHero } from '../../hooks/useContestHero';
import { joinContest, leaveContest } from '../../api/contests';
import { secondsUntil, formatDuration, fmtCountdown } from '../../utils/time';

// Forces a re-render every second so countdowns derived from a timestamp stay
// live. Off when there's no contest to count down to.
function useTick(active) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

// Contest problems are labelled by position: A, B, C, …
const pip = (i) => String.fromCharCode(65 + i);

const STATUS_ICON = { solved: 'checkBold', attempted: 'bolt' };
const STATUS_COLOR = { solved: 'var(--ac)', attempted: 'var(--tle)' };

// Presentational hero — takes the useContestHero result. Split out so a page
// can lift the hook (e.g. to know which contest is featured) and still render
// the same hero without fetching twice.
export function ContestHeroView({ state, data, loading, error, reload }) {
  useTick(state === 'live' || state === 'soon');

  if (loading) {
    return (
      <section className="hero">
        <div className="list-msg">Loading…</div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="hero">
        <div className="list-msg">Couldn’t load the contest.</div>
      </section>
    );
  }
  if (state === 'none') return <NoContest />;

  return state === 'live' ? (
    <LiveHero contest={data.contest} standing={data.standing} />
  ) : (
    <SoonHero contest={data.contest} onChanged={reload} />
  );
}

export default function ContestHero() {
  const hero = useContestHero();
  return <ContestHeroView {...hero} />;
}

function LiveHero({ contest, standing }) {
  const I = Icons;
  const remaining = secondsUntil(contest.end_time);
  const urgent = remaining < 5 * 60;

  const statusById = Object.fromEntries(
    standing.problems.map((p) => [p.id, p.status])
  );
  const problems = contest.problems.map((p, i) => ({
    id: p.id,
    label: pip(i),
    title: p.title,
    status: statusById[p.id] || 'open',
  }));

  return (
    <section className="hero">
      <div className="hero-hd">
        <span className="hbadge live">
          <span className="d" /> Live now
        </span>
        <span className="reg-chip">
          <I.users size={14} />{' '}
          <b>{contest.participants_count.toLocaleString()}</b> competing
        </span>
      </div>

      <div className="hero-title">{contest.title}</div>
      <div className="hero-round">{contest.subtitle}</div>

      <div className="hero-meta">
        <div className="m">
          <div className="k">Ends in</div>
          <div className={`v clock${urgent ? ' urgent' : ''}`}>
            {fmtCountdown(remaining)}
          </div>
        </div>
        <div className="m">
          <div className="k">Duration</div>
          <div className="v">
            {formatDuration(contest.start_time, contest.end_time)}
          </div>
        </div>
        <div className="m">
          <div className="k">Problems</div>
          <div className="v">{problems.length}</div>
        </div>
        <div className="m">
          <div className="k">Your rank</div>
          <div className="v">
            {standing.rank != null ? `#${standing.rank}` : '—'}
          </div>
        </div>
      </div>

      <div className="hero-probs">
        {problems.map((p) => {
          const St = Icons[STATUS_ICON[p.status]] || I.chevRight;
          return (
            <a key={p.id} className={`hpip s-${p.status}`} href="#">
              <span className="lid">{p.label}</span>
              <span className="ld">
                <span className="nm">{p.title}</span>
              </span>
              <span
                className="stx"
                style={{ color: STATUS_COLOR[p.status] || 'var(--fg3)' }}
              >
                <St size={15} />
              </span>
            </a>
          );
        })}
      </div>

      <div className="hero-foot">
        <div className="hero-stand">
          <div className="s">
            <div className="k">Score</div>
            <div className="v">
              <span className="pl">{standing.score}</span>
            </div>
          </div>
          <div className="s">
            <div className="k">Solved</div>
            <div className="v">
              {standing.solved}/{problems.length}
            </div>
          </div>
        </div>
        <div className="hero-cta">
          <a className="btn btn-primary" href="#">
            <I.play size={15} /> Enter round
          </a>
        </div>
      </div>
    </section>
  );
}

function SoonHero({ contest, onChanged }) {
  const I = Icons;
  const startsIn = secondsUntil(contest.start_time);

  const register = async () => {
    try {
      await joinContest(contest.id);
      onChanged();
    } catch {
      // leave the button as-is on failure
    }
  };
  const unregister = async () => {
    try {
      await leaveContest(contest.id);
      onChanged();
    } catch {
      // leave the button as-is on failure
    }
  };

  return (
    <section className="hero">
      <div className="hero-hd">
        <span className="hbadge soon">
          <I.clock size={13} /> Starts soon
        </span>
        <span className="reg-chip">
          <I.users size={14} />{' '}
          <b>{contest.participants_count.toLocaleString()}</b> registered
        </span>
      </div>

      <div className="hero-title">{contest.title}</div>
      <div className="hero-round">{contest.subtitle}</div>

      <div className="hero-meta">
        <div className="m">
          <div className="k">Starts in</div>
          <div className="v clock">{fmtCountdown(startsIn)}</div>
        </div>
        <div className="m">
          <div className="k">Duration</div>
          <div className="v">
            {formatDuration(contest.start_time, contest.end_time)}
          </div>
        </div>
        <div className="m">
          <div className="k">Problems</div>
          <div className="v">{contest.problems_count}</div>
        </div>
      </div>

      <div className="hero-preview">
        <span className="pv-k">Problems</span>
        <div className="pv-pips">
          {Array.from({ length: contest.problems_count }, (_, i) => (
            <span key={i} className="pv-pip">
              {pip(i)}
            </span>
          ))}
        </div>
        <span className="pv-note">revealed when the round starts</span>
      </div>

      <div className="hero-foot">
        <div className="hero-stand">
          <div className="s">
            <div className="k">Going</div>
            <div className="v">
              {contest.participants_count.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="hero-cta">
          {contest.is_joined ? (
            <button className="reg-pill done" onClick={unregister}>
              <I.checkBold size={14} /> Registered
            </button>
          ) : (
            <button className="btn btn-primary" onClick={register}>
              <I.flag size={15} /> Register
            </button>
          )}
          <a className="btn" href="#">
            Problems
          </a>
        </div>
      </div>
    </section>
  );
}

function NoContest() {
  const I = Icons;
  return (
    <section className="hero">
      <div className="hero-hd">
        <span className="hbadge none">No live contest</span>
      </div>
      <div className="hero-title">No active or upcoming contests</div>
      <div className="hero-round">
        New rounds will appear here once scheduled.
      </div>
      <div className="hero-foot">
        <div className="hero-stand" />
        <div className="hero-cta">
          <a className="btn btn-primary" href="#">
            <I.trophy size={15} /> Browse contests
          </a>
        </div>
      </div>
    </section>
  );
}
