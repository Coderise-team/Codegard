import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icons from '../Icons';
import StandingsList from './StandingsList';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { cgRankFor } from '../../utils/ranks';

// Own row points to the (future) my-profile page, others to the public profile.
const profileHref = (username, you) =>
  username === you ? '/profile' : `/users/${username}`;

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

  // On phones the panel opens below the fold — bring it into view so the
  // rows show up without manual scrolling. A no-op when already visible.
  const asideRef = useRef(null);
  useEffect(() => {
    if (open) {
      asideRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [open]);

  if (!open) {
    return (
      <button className="cp-aside-tab" onClick={onToggle} title="Show panel">
        <I.users size={16} />
        <span className="lbl">
          {state === 'soon' ? 'Registered' : 'Standings'}
        </span>
        <I.chevRight size={14} className="cp-tab-arrow" />
      </button>
    );
  }

  const isReg = state === 'soon';

  return (
    <aside className="cp-aside" ref={asideRef}>
      <button className="cp-aside-hd" onClick={onToggle} title="Hide panel">
        <span className="t">
          {isReg ? <I.users size={15} /> : <I.trophy size={15} />}
          {isReg
            ? 'Registered'
            : state === 'finished'
              ? 'Final standings'
              : 'Standings'}
        </span>
        {state === 'live' ? (
          <span className="live-dot">
            <span className="d" /> LIVE
          </span>
        ) : (
          <span className="cnt">{total.toLocaleString('en-US')}</span>
        )}
        <I.chevRight size={16} className="cp-hd-arrow" />
      </button>

      {isReg ? (
        <>
          <div className="cp-thead">
            <span className="cp-rk">#</span>
            <span className="cp-user">User</span>
            <span className="cp-tier">Rank</span>
            <span className="cp-cell">Rating</span>
          </div>
          <div className="cp-aside-body scroll">
            {loading ? (
              <div className="cp-msg">Loading…</div>
            ) : error ? (
              <div className="cp-msg">Couldn’t load the list.</div>
            ) : rows.length === 0 ? (
              <div className="cp-msg">No one has registered yet.</div>
            ) : (
              <>
                {rows.map((r, i) => (
                  <RegRow key={r.username} r={r} rank={i + 1} you={you} />
                ))}
                {hasMore && (
                  <div
                    ref={sentinelRef}
                    className="cp-sentinel"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <StandingsList
          state={state}
          panel={panel}
          problemsCount={problemsCount}
          you={you}
          myStanding={myStanding}
        />
      )}
    </aside>
  );
}

function RegRow({ r, rank, you }) {
  return (
    <Link
      className={`cp-row${r.username === you ? ' you' : ''}`}
      to={profileHref(r.username, you)}
    >
      <span className="cp-rk">{rank}</span>
      <span className="cp-user">{r.username}</span>
      <span className="cp-tier">{cgRankFor(r.elo_rating).name}</span>
      <span className="cp-cell cp-pts">{r.elo_rating}</span>
    </Link>
  );
}
