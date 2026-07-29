import { Link } from 'react-router-dom';
import Icons from '../Icons';
import { fmtCountdown } from '../../utils/time';

/**
 * ContestBanner — the single-contest event banner (upcoming / live / finished).
 *
 * The whole stage reads as one violet gradient banner (reuses the .hero
 * vocabulary from Dashboard.css). Problems sit inline as .hpip buttons, the
 * timer uses the .cc-count block, and Register reuses .reg-pill.
 *
 * Props:
 *   D          — contest data object
 *   contestId  — the round id, for the problem-strip and Enter-round links
 *   state      — 'soon' | 'live' | 'finished'
 *   seconds    — countdown seconds for the current state
 *   registered — boolean; gates entering the problems
 *   onToggle   — () => void; registers or unregisters
 */
export default function ContestBanner({
  D,
  contestId,
  state,
  seconds,
  registered,
  onToggle,
}) {
  const I = Icons;
  const c = D.contest;

  const badge =
    state === 'live' ? (
      <span className="hbadge live">
        <span className="d" /> Live now
      </span>
    ) : state === 'finished' ? (
      <span className="hbadge none">Finished</span>
    ) : (
      <span className="hbadge soon">
        <I.clock size={13} /> Registration open
      </span>
    );

  const chipVerb =
    state === 'live'
      ? 'competing'
      : state === 'finished'
        ? 'competed'
        : 'registered';
  const timerLabel =
    state === 'live' ? 'Ends in' : state === 'finished' ? 'Ended' : 'Starts in';
  const timerVal = state === 'finished' ? c.endedAgo : fmtCountdown(seconds);
  const urgent = state === 'live' && seconds < 5 * 60;

  const your = D.yourProbs[state] || [];

  // "Enter round" only means something once you're in it: a non-registered
  // viewer gets Register instead (joining is allowed while a contest is live).
  // It lands on the first problem not yet solved (all solved -> the first one),
  // so it never drops you on a done task.
  const firstUnsolvedIdx = D.problems.findIndex(
    (_, i) => (your[i] || 'open') !== 'solved'
  );
  const enterLetter =
    D.problems[firstUnsolvedIdx >= 0 ? firstUnsolvedIdx : 0]?.id;
  let cta;
  if (state === 'live' && registered) {
    cta = enterLetter ? (
      <Link
        className="btn btn-primary"
        to={`/contests/${contestId}/problems/${enterLetter}`}
      >
        <I.play size={15} /> Enter round
      </Link>
    ) : null;
  } else if (state === 'finished') {
    cta = null;
  } else if (registered) {
    cta = (
      <button className="reg-pill done" onClick={onToggle}>
        <I.checkBold size={14} /> Registered
      </button>
    );
  } else {
    cta = (
      <button className="reg-pill go" onClick={onToggle}>
        <I.flag size={13} /> Register
      </button>
    );
  }

  return (
    <div className="cp-content">
      <div className="cp-c-in">
        <div className="cp-top">
          <div className="cp-hd">
            {badge}
            <span className="reg-chip">
              <I.users size={14} />{' '}
              <b>{c.registeredCount.toLocaleString('en-US')}</b> {chipVerb}
            </span>
          </div>

          <h1 className="cp-title">{c.name}</h1>

          <div className="cp-metarow">
            <span>
              <I.calendar size={14} /> {c.date}
            </span>
            <span>
              <I.clock size={14} /> {c.time}
            </span>
            <span>
              <I.grid size={13} /> {D.problems.length} problems
            </span>
            <span>
              <I.hourglass size={14} /> {c.duration}
            </span>
          </div>
        </div>

        <div className="cp-bottom">
          <div className="cc-count cp-count">
            <span className="k">{timerLabel}</span>
            <span className={`v${urgent ? ' urgent' : ''}`}>{timerVal}</span>
          </div>
          {cta && <div className="cp-cta">{cta}</div>}

          <div className="cp-probs">
            <span className="cp-probs-k">Problems</span>
            <div className="hero-probs">
              {D.problems.map((p, i) => {
                if (state === 'soon') {
                  return (
                    <span key={p.id} className="hpip s-locked">
                      <span className="lid">{p.id}</span>
                      <span className="ld">
                        <span className="nm">Locked</span>
                        <span className="pt">reveals at start</span>
                      </span>
                      <span className="stx">
                        <I.clock size={14} />
                      </span>
                    </span>
                  );
                }
                const st = your[i] || 'open';
                const St =
                  st === 'solved'
                    ? I.checkBold
                    : st === 'attempted'
                      ? I.bolt
                      : st === 'locked'
                        ? null
                        : I.chevRight;
                // Clickable only for a registered participant; a locked slot and
                // a non-participant both render as an inert pip.
                const clickable = registered && st !== 'locked';
                const Tag = clickable ? Link : 'span';
                const linkProps = clickable
                  ? { to: `/contests/${contestId}/problems/${p.id}` }
                  : {};
                return (
                  <Tag key={p.id} className={`hpip s-${st}`} {...linkProps}>
                    <span className="lid">{p.id}</span>
                    <span className="ld">
                      <span className="nm">{p.title}</span>
                      {p.solvedBy != null && (
                        <span className="pt">
                          {p.solvedBy.toLocaleString('en-US')} solved
                        </span>
                      )}
                    </span>
                    <span
                      className="stx"
                      style={{
                        color:
                          st === 'solved'
                            ? 'var(--ac)'
                            : st === 'attempted'
                              ? 'var(--tle)'
                              : 'var(--fg3)',
                      }}
                    >
                      {St && <St size={15} />}
                    </span>
                  </Tag>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
