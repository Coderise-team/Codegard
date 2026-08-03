import { Link } from 'react-router-dom';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import './StandingsList.css';

// One profile route for everyone, your own row included: the page works out
// that you own it, and keeping the url the same is what makes a row shareable.
const profileHref = (username) => `/users/${username}`;

/**
 * StandingsList — the contest standings table (column header + rows), shared by
 * the contest page aside and the in-workspace rail so both look and behave the
 * same. Rows arrive paginated via useContestPanel; scrolling loads more pages.
 *
 * Props:
 *   state         — 'live' | 'finished' (adds the rating-delta column when finished)
 *   panel         — useContestPanel result { rows, hasMore, loading, error, loadMore }
 *   problemsCount — total problems, for the solved/total cell
 *   you           — current user's username; highlights own rows + links to /profile
 *   myStanding    — my-standing payload; pins my row under the list when it
 *                   hasn't been scrolled into view yet (live only)
 */
export default function StandingsList({
  state,
  panel,
  problemsCount,
  you,
  myStanding,
}) {
  const { rows, hasMore, loading, error, loadMore } = panel;
  const sentinelRef = useInfiniteScroll(loadMore, hasMore);
  const youShown = rows.some((r) => r.username === you);
  const myRow =
    state === 'live' && !youShown && myStanding?.rank != null
      ? myStanding
      : null;

  return (
    <>
      <div className="cp-thead">
        <span className="cp-rk">#</span>
        <span className="cp-user">User</span>
        <span className="cp-cell">Solved</span>
        <span className="cp-cell">Pts</span>
        <span className="cp-cell cp-c-pen">Penalty</span>
        {state === 'finished' && <span className="cp-cell">Δ</span>}
      </div>

      <div className="cp-aside-body scroll">
        {loading ? (
          <div className="cp-msg">Loading…</div>
        ) : error ? (
          <div className="cp-msg">Couldn’t load the standings.</div>
        ) : rows.length === 0 ? (
          <div className="cp-msg">No submissions yet.</div>
        ) : (
          <>
            {rows.map((r) => (
              <LbRow
                key={r.username}
                r={r}
                state={state}
                n={problemsCount}
                you={you}
              />
            ))}
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
                <Link className="cp-row you" to={profileHref(you)}>
                  <span className="cp-rk">{myRow.rank}</span>
                  <span className="cp-user">{you}</span>
                  <span className="cp-cell">
                    {myRow.solved}/{problemsCount}
                  </span>
                  <span className="cp-cell cp-pts">{myRow.score}</span>
                  <span className="cp-cell cp-c-pen">—</span>
                  {state === 'finished' && <span className="cp-cell">—</span>}
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function LbRow({ r, state, n, you }) {
  const cls = `cp-row${r.username === you ? ' you' : ''}${
    r.rank <= 3 ? ' r' + r.rank : ''
  }`;
  return (
    <Link className={cls} to={profileHref(r.username)}>
      <span className="cp-rk">{r.rank}</span>
      <span className="cp-user">{r.username}</span>
      <span className="cp-cell">
        {r.solved_count}/{n}
      </span>
      <span className="cp-cell cp-pts">{r.score}</span>
      <span className="cp-cell cp-c-pen">{r.penalty}</span>
      {state === 'finished' &&
        (r.rating_delta != null ? (
          <span
            className={`cp-cell cp-dl ${r.rating_delta >= 0 ? 'up' : 'down'}`}
          >
            {r.rating_delta >= 0 ? '+' : ''}
            {r.rating_delta}
          </span>
        ) : (
          <span className="cp-cell">—</span>
        ))}
    </Link>
  );
}
