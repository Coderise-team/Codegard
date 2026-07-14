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
import NotFoundPage from './NotFoundPage';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useProfile } from '../hooks/useProfile';
import { useStreak } from '../hooks/useStreak';
import { isNotFound } from '../utils/errors';
import { cgRankFor } from '../utils/ranks';
import './ProfilePage.css';

/**
 * ProfilePage — a user's public profile viewed by username. The page fetches
 * the user + rating history once (useProfile) and hands them to the header,
 * ring and chart. The other blocks fetch their own slice by username.
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

  // Fourth stat card (the profile has no Daily block to carry the streak).
  const { data: streak } = useStreak(username);
  const extraStats = [
    {
      key: 'streak',
      label: 'Max streak',
      icon: 'flame',
      value: streak ? `${streak.longest_streak} d` : '—',
    },
  ];

  // An unknown username is a 404, not a failure — any other error (server down,
  // connection dropped) has to say so instead of blaming the nickname.
  // The nickname itself is never echoed back: it comes straight from the URL,
  // so a crafted link could put any text on a page that looks like ours.
  if (isNotFound(error)) {
    return (
      <NotFoundPage
        title="User not found"
        sub="This user does not exist, or the profile was removed."
      />
    );
  }

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
          title="Profile"
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="canvas scroll">
          <div className="canvas-in">
            {loading && <div className="list-msg">Loading…</div>}
            {error && (
              <div className="list-msg">
                Could not load this profile. Please try again.
              </div>
            )}

            {user && (
              <div className="lay-overview">
                <ProfileHeader user={user} delta={delta} />
                <StatsStrip username={username} extraStats={extraStats} />

                <div className="cols">
                  <div className="col-main">
                    <RatingChart user={user} history={history} />
                    <ActivityHeatmap username={username} />
                    <RecentSubmissions username={username} />
                  </div>
                  <div className="col-rail">
                    <ProfileRing user={user} />
                    <DifficultyBreakdown username={username} />
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
