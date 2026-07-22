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
 *   state      — 'soon' | 'live' | 'finished'
 *   seconds    — countdown seconds for the current state
 *   registered — boolean (soon state)
 *   onToggle   — () => void; registers or unregisters
 */
export default function ContestBanner({
  D,
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

  let cta;
  if (state === 'live') {
    cta = (
      <a className="btn btn-primary" href="#">
        <I.play size={15} /> Enter round
      </a>
    );
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
                const href = st === 'locked' ? undefined : '#';
                const Tag = href ? 'a' : 'span';
                return (
                  <Tag key={p.id} className={`hpip s-${st}`} href={href}>
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
