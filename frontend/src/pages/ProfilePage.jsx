import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import StatsStrip from '../components/dashboard/StatsStrip';
import ActivityHeatmap from '../components/dashboard/ActivityHeatmap';
import RecentSubmissions from '../components/dashboard/RecentSubmissions';
import PastContests from '../components/dashboard/PastContests';
import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileRing from '../components/profile/ProfileRing';
import RatingChart from '../components/profile/RatingChart';
import DifficultyBreakdown from '../components/profile/DifficultyBreakdown';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useProfile } from '../hooks/useProfile';
import { cgRankFor } from '../utils/ranks';
import profileData from '../data/profileData';
import './ProfilePage.css';

/**
 * ProfilePage — a user's public profile viewed by username. The page fetches
 * the user + rating history once (useProfile) and hands them to the header
 * (and, later, the ring and chart). The other blocks fetch their own slice by
 * username.
 *
 * STUB: ProfileRing / RatingChart / DifficultyBreakdown still render from mock
 * profileData; they get wired to the API in the next steps.
 */
export default function ProfilePage() {
  const viewer = useCurrentUser();
  const { username } = useParams();
  const [navOpen, setNavOpen] = useState(false);

  const { data: profile, loading, error } = useProfile(username);
  const user = profile?.user;
  const history = profile?.history;

  // Delta = change between the two latest rating points (computed on the fly).
  const delta = useMemo(() => {
    if (!history || history.length < 2) return null;
    return (
      history[history.length - 1].rating - history[history.length - 2].rating
    );
  }, [history]);

  const D = profileData; // STUB

  // Rank-tinted variables (header gradient, avatar, rank chip, ELO ring).
  const color = user ? cgRankFor(user.elo_rating).color : 'var(--fg3)';
  const rankVars = {
    '--rank-c': color,
    '--rank-hi': `color-mix(in srgb, ${color} 60%, #ffffff)`,
    '--rank-soft': `color-mix(in srgb, ${color} 14%, transparent)`,
    '--rank-line': `color-mix(in srgb, ${color} 40%, transparent)`,
  };

  return (
    <div className="dash" data-density="compact" style={rankVars}>
      <Sidebar user={viewer} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={viewer}
          title={
            <>
              <span className="dim">Users / </span>
              {username}
            </>
          }
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="canvas scroll">
          <div className="canvas-in">
            {loading && <div className="list-msg">Loading…</div>}
            {error && <div className="list-msg">Couldn’t load profile.</div>}

            {user && (
              <div className="lay-overview">
                <ProfileHeader user={user} delta={delta} />
                <StatsStrip username={username} />

                <div className="cols">
                  <div className="col-main">
                    <RatingChart user={user} history={history} />
                    <ActivityHeatmap username={username} />
                    <RecentSubmissions username={username} />
                  </div>
                  <div className="col-rail">
                    <ProfileRing user={user} />
                    <DifficultyBreakdown data={D} />
                    <PastContests username={username} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
