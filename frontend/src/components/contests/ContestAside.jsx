import { useState } from 'react';
import Icons from '../Icons';

/**
 * ContestAside — right-attached, collapsible registrants / standings panel.
 * Shows registrants when upcoming, live standings when live, and final
 * standings (with rating deltas) when finished.
 *
 * Props:
 *   D        — contest data object
 *   state    — 'soon' | 'live' | 'finished'
 *   open     — boolean; when false renders the collapsed edge tab
 *   onToggle — () => void
 */
export default function ContestAside({ D, state, open, onToggle }) {
  const I = Icons;
  const [all, setAll] = useState(false);

  if (!open) {
    return (
      <button className="cp-aside-tab" onClick={onToggle} title="Show panel">
        <I.users size={16} />
        <span className="lbl">
          {state === 'soon' ? 'Registered' : 'Standings'}
        </span>
        <I.chevRight size={14} style={{ transform: 'rotate(180deg)' }} />
      </button>
    );
  }

  const isReg = state === 'soon';
  const rows = isReg
    ? D.registrants
    : state === 'finished'
      ? D.finalStandings
      : D.standings;
  const shown = all ? rows : rows.slice(0, 10);
  const you = rows.find((r) => r.you);
  const youShown = shown.some((r) => r.you);

  return (
    <aside className="cp-aside">
      <div className="cp-aside-hd">
        <div className="t">
          {isReg ? <I.users size={15} /> : <I.trophy size={15} />}
          {isReg
            ? 'Registered'
            : state === 'finished'
              ? 'Final standings'
              : 'Standings'}
        </div>
        {state === 'live' ? (
          <span className="live-dot">
            <span className="d" /> LIVE
          </span>
        ) : (
          <span className="cnt">
            {isReg
              ? D.contest.registeredCount.toLocaleString('en-US')
              : rows.length}
          </span>
        )}
        <button className="cp-aside-x" onClick={onToggle} title="Hide panel">
          <I.chevRight size={16} />
        </button>
      </div>

      <div className="cp-aside-body scroll">
        {shown.map((r) =>
          isReg ? (
            <RegRow key={r.handle} r={r} rank={rows.indexOf(r) + 1} />
          ) : (
            <LbRow key={r.handle} r={r} state={state} n={D.problems.length} />
          )
        )}
        {!all && !youShown && you && (
          <>
            <div className="cp-gap">⋯</div>
            {isReg ? (
              <RegRow r={you} rank={rows.indexOf(you) + 1} />
            ) : (
              <LbRow r={you} state={state} n={D.problems.length} />
            )}
          </>
        )}
      </div>

      <button
        className={`cp-showall${all ? ' open' : ''}`}
        onClick={() => setAll(!all)}
      >
        {all ? 'Show top 10' : `Show all ${rows.length}`}{' '}
        <I.chevDown size={14} />
      </button>
    </aside>
  );
}

function RegRow({ r, rank }) {
  return (
    <div className={`cp-row${r.you ? ' you' : ''}`}>
      <div className="cp-rk">{rank}</div>
      <div className="cp-who">
        <div className="h">{r.handle}</div>
        <div className="sub">{r.tier}</div>
      </div>
      <div className="cp-rt">{r.rating}</div>
    </div>
  );
}

function LbRow({ r, state, n }) {
  const cls = `cp-row${r.you ? ' you' : ''}${r.rank <= 3 ? ' r' + r.rank : ''}`;
  return (
    <div className={cls}>
      <div className="cp-rk">{r.rank}</div>
      <div className="cp-who">
        <div className="h">{r.handle}</div>
        <div className="sub">
          {r.solved}/{n} · {r.penalty}
        </div>
      </div>
      {state === 'finished' && r.delta != null ? (
        <div className={`cp-dl ${r.delta >= 0 ? 'up' : 'down'}`}>
          {r.delta >= 0 ? '+' : ''}
          {r.delta}
        </div>
      ) : (
        <div className="cp-rt">{r.rating}</div>
      )}
    </div>
  );
}
