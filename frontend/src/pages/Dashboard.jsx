import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import ProfileCard from '../components/dashboard/ProfileCard';
import ContestHero from '../components/dashboard/ContestHero';
import StatsStrip from '../components/dashboard/StatsStrip';
import Recommended from '../components/dashboard/Recommended';
import RecentSubmissions from '../components/dashboard/RecentSubmissions';
import ActivityHeatmap from '../components/dashboard/ActivityHeatmap';
import DailyChallenge from '../components/dashboard/DailyChallenge';
import UpcomingContests from '../components/dashboard/UpcomingContests';
import PastContests from '../components/dashboard/PastContests';
import { useCurrentUser } from '../hooks/useCurrentUser';
import './Dashboard.css';

/**
 * Dashboard — main page (SWAP layout, compact density, violet accent).
 * Each block fetches its own data; the shell user comes from useCurrentUser.
 */
export default function Dashboard() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="dash" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
          title="Dashboard"
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="canvas scroll">
          <div className="canvas-in">
            <div className="hello">
              <h1>
                Welcome back, <b>{user?.username}</b>
              </h1>
            </div>

            <div className="lay-swap">
              <div className="top-band">
                <ProfileCard />
                <ContestHero />
              </div>

              <StatsStrip username={user?.username} />

              <div className="cols">
                <div className="col-main">
                  <Recommended />
                  <RecentSubmissions />
                  <ActivityHeatmap username={user?.username} />
                </div>
                <div className="col-rail">
                  <DailyChallenge />
                  <UpcomingContests />
                  <PastContests username={user?.username} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
