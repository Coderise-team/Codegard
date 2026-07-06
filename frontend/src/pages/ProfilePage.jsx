import { useState } from 'react';
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
import profileData from '../data/profileData';
import './ProfilePage.css';

/**
 * ProfilePage — a user's public profile viewed by username.
 *
 * STUB: the whole page still renders from mock profileData, and the reused
 * dashboard blocks (StatsStrip/ActivityHeatmap/RecentSubmissions/PastContests)
 * still fetch the signed-in user's own data. Per-username fetching and the
 * profile-specific blocks get wired to the API in later steps.
 */
export default function ProfilePage() {
  const user = useCurrentUser();
  const { username } = useParams();
  const [navOpen, setNavOpen] = useState(false);

  const D = profileData; // STUB
  const rank = D.user.rank;

  // Rank-tinted variables (header gradient, avatar, rank chip, ELO ring).
  const rankVars = {
    '--rank-c': rank.color,
    '--rank-hi': `color-mix(in srgb, ${rank.color} 60%, #ffffff)`,
    '--rank-soft': `color-mix(in srgb, ${rank.color} 14%, transparent)`,
    '--rank-line': `color-mix(in srgb, ${rank.color} 40%, transparent)`,
  };

  return (
    <div className="dash" data-density="compact" style={rankVars}>
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
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
            <div className="lay-overview">
              <ProfileHeader data={D} />
              <StatsStrip />

              <div className="cols">
                <div className="col-main">
                  <RatingChart data={D} />
                  <ActivityHeatmap />
                  <RecentSubmissions />
                </div>
                <div className="col-rail">
                  <ProfileRing data={D} />
                  <DifficultyBreakdown data={D} />
                  <PastContests />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
