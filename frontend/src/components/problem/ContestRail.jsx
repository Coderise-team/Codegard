import { Link } from 'react-router-dom';
import Icons from '../Icons';
import './ContestRail.css';

// Own row -> my-profile, everyone else -> their public profile.
const profileHref = (username, you) =>
  username === you ? '/profile' : `/users/${username}`;

/**
 * ContestRail — compact live standings beside the editor in contest mode,
 * dropped into the ProblemWorkspace `rail` slot.
 *
 * Shows the top slice from useContestPanel, refetched on the paced socket
 * signal; the viewer's own row is highlighted, and pinned at the bottom when it
 * falls outside the visible slice. A footer link opens the full, paginated
 * standings on the contest page.
 *
 * Props:
 *   contestId  — the round id, for the profile/full-standings links
 *   live       — show the LIVE marker while the round is running
 *   panel      — useContestPanel result: { rows, loading, error }
 *   you        — current user's username; highlights own rows
 *   myStanding — my-standing payload; pins my row when it is off the slice
 */
export default function ContestRail({
  contestId,
  live,
  panel,
  you,
  myStanding,
}) {
  const { rows, loading, error } = panel;
  const youShown = rows.some((r) => r.username === you);
  const pinned = !youShown && myStanding?.rank != null ? myStanding : null;

  return (
    <aside className="cpp-rail">
      <div className="cpp-rail-hd">
        <span className="t">
          <Icons.trophy size={14} /> Standings
        </span>
        {live && (
          <span className="cpp-rail-live">
            <span className="d" /> LIVE
          </span>
        )}
      </div>

      <div className="cpp-rail-body scroll">
        {loading ? (
          <div className="cpp-rail-msg">Loading…</div>
        ) : error ? (
          <div className="cpp-rail-msg">Couldn’t load standings.</div>
        ) : rows.length === 0 ? (
          <div className="cpp-rail-msg">No submissions yet.</div>
        ) : (
          <>
            {rows.map((r) => (
              <Row key={r.username} r={r} you={you} />
            ))}
            {pinned && (
              <>
                <div className="cpp-rail-gap">⋯</div>
                <Link className="cpp-rail-row you" to="/profile">
                  <span className="rk">{pinned.rank}</span>
                  <span className="u">{you}</span>
                  <span className="v">{pinned.score}</span>
                  <span className="v pen">—</span>
                </Link>
              </>
            )}
          </>
        )}
      </div>

      <Link className="cpp-rail-all" to={`/contests/${contestId}`}>
        Full standings <Icons.chevRight size={13} />
      </Link>
    </aside>
  );
}

function Row({ r, you }) {
  const cls =
    `cpp-rail-row${r.username === you ? ' you' : ''}` +
    (r.rank <= 3 ? ' top' : '');
  return (
    <Link className={cls} to={profileHref(r.username, you)}>
      <span className="rk">{r.rank}</span>
      <span className="u">{r.username}</span>
      <span className="v">{r.score}</span>
      <span className="v pen">{r.penalty}</span>
    </Link>
  );
}
