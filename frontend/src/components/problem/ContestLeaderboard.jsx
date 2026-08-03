import Icons from '../Icons';
import StandingsList from '../contests/StandingsList';
import './ContestLeaderboard.css';

/**
 * ContestLeaderboard — the contest standings beside the editor in contest mode,
 * dropped into the ProblemWorkspace `rail` slot.
 *
 * It renders the exact same StandingsList table as the contest page, so the
 * board looks and behaves identically in both places; only the surrounding
 * chrome (header + LIVE marker) belongs to this panel.
 *
 * Props:
 *   live          — show the LIVE marker while the round is running
 *   panel         — useContestPanel result
 *   problemsCount — total problems, for the solved/total cell
 *   you           — current user's username; highlights + links own row
 *   myStanding    — my-standing payload; pins my row when off the loaded slice
 */
export default function ContestLeaderboard({
  live,
  panel,
  problemsCount,
  you,
  myStanding,
}) {
  return (
    <aside className="cpp-lb">
      <div className="cpp-lb-hd">
        <span className="t">
          <Icons.trophy size={14} /> Standings
        </span>
        {live && (
          <span className="cpp-lb-live">
            <span className="d" /> LIVE
          </span>
        )}
      </div>

      <StandingsList
        state={live ? 'live' : 'finished'}
        panel={panel}
        problemsCount={problemsCount}
        you={you}
        myStanding={myStanding}
      />
    </aside>
  );
}
