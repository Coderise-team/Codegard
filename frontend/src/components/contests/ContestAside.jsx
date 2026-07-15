import Icons from '../Icons';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { cgRankFor } from '../../utils/ranks';

/**
 * ContestAside — right-attached, collapsible registrants / standings panel.
 * Shows registrants when upcoming, live standings when live, and final
 * standings (with rating deltas) when finished. Rows arrive paginated via
 * useContestPanel; scrolling the panel loads the next pages.
 *
 * Props:
 *   state         — 'soon' | 'live' | 'finished'
 *   open          — boolean; when false renders the collapsed edge tab
 *   onToggle      — () => void
 *   panel         — useContestPanel result: { rows, total, hasMore, loading, error, loadMore }
 *   problemsCount — total problems, for the solved/total sub-line
 *   you           — current user's username; highlights own rows
 *   myStanding    — my-standing payload; renders my row under the list while
 *                   it hasn't been scrolled into view yet (live only)
 */
export default function ContestAside({
  state,
  open,
  onToggle,
  panel,
  problemsCount,
  you,
  myStanding,
}) {
  const I = Icons;
  const { rows, total, hasMore, loading, error, loadMore } = panel;
  const sentinelRef = useInfiniteScroll(loadMore, hasMore);

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
  const youShown = rows.some((r) => r.username === you);
  const myRow =
    state === 'live' && !youShown && myStanding?.rank != null
      ? myStanding
      : null;

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
          <span className="cnt">{total.toLocaleString('en-US')}</span>
        )}
        <button className="cp-aside-x" onClick={onToggle} title="Hide panel">
          <I.chevRight size={16} />
        </button>
      </div>

      <div className="cp-aside-body scroll">
        {loading ? (
          <div className="cp-msg">Loading…</div>
        ) : error ? (
          <div className="cp-msg">Couldn’t load the list.</div>
        ) : rows.length === 0 ? (
          <div className="cp-msg">
            {isReg ? 'No one has registered yet.' : 'No submissions yet.'}
          </div>
        ) : (
          <>
            {rows.map((r, i) =>
              isReg ? (
                <RegRow key={r.username} r={r} rank={i + 1} you={you} />
              ) : (
                <LbRow
                  key={r.username}
                  r={r}
                  state={state}
                  n={problemsCount}
                  you={you}
                />
              )
            )}
            {hasMore && (
              <div
                ref={sentinelRef}
                className="cp-sentinel"
                aria-hidden="true"
              />
            )}
            {myRow && (
              <>
                <div className="cp-gap">⋯</div>
                <div className="cp-row you">
                  <div className="cp-rk">{myRow.rank}</div>
                  <div className="cp-who">
                    <div className="h">{you}</div>
                    <div className="sub">
                      {myRow.solved}/{problemsCount}
                    </div>
                  </div>
                  <div className="cp-rt">{myRow.score}</div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function RegRow({ r, rank, you }) {
  return (
    <div className={`cp-row${r.username === you ? ' you' : ''}`}>
      <div className="cp-rk">{rank}</div>
      <div className="cp-who">
        <div className="h">{r.username}</div>
        <div className="sub">{cgRankFor(r.elo_rating).name}</div>
      </div>
      <div className="cp-rt">{r.elo_rating}</div>
    </div>
  );
}

function LbRow({ r, state, n, you }) {
  const cls = `cp-row${r.username === you ? ' you' : ''}${
    r.rank <= 3 ? ' r' + r.rank : ''
  }`;
  return (
    <div className={cls}>
      <div className="cp-rk">{r.rank}</div>
      <div className="cp-who">
        <div className="h">{r.username}</div>
        <div className="sub">
          {state === 'finished'
            ? `${r.score} · ${r.solved_count}/${n} · ${r.penalty}`
            : `${r.solved_count}/${n} · ${r.penalty}`}
        </div>
      </div>
      {state === 'finished' && r.rating_delta != null ? (
        <div className={`cp-dl ${r.rating_delta >= 0 ? 'up' : 'down'}`}>
          {r.rating_delta >= 0 ? '+' : ''}
          {r.rating_delta}
        </div>
      ) : (
        <div className="cp-rt">{r.score}</div>
      )}
    </div>
  );
}
