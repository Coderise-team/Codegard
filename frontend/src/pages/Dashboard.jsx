import { useNavigate } from 'react-router-dom';

import AppShell from '../components/layout/AppShell';
import ProfileCard from '../components/dashboard/ProfileCard';
import ContestHero from '../components/dashboard/ContestHero';
import StatsStrip from '../components/dashboard/StatsStrip';
import Recommended from '../components/dashboard/Recommended';
import RecentSubmissions from '../components/dashboard/RecentSubmissions';
import ActivityHeatmap from '../components/dashboard/ActivityHeatmap';
import DailyChallenge from '../components/dashboard/DailyChallenge';
import MyContests from '../components/dashboard/MyContests';
import PastContests from '../components/dashboard/PastContests';
import { useCurrentUser } from '../hooks/useCurrentUser';
import './Dashboard.css';

/**
 * Dashboard — main page (SWAP layout, compact density, violet accent).
 * Each block fetches its own data; the shell user comes from useCurrentUser.
 */
export default function Dashboard() {
  const user = useCurrentUser();
  const navigate = useNavigate();

  // The dashboard holds no list of its own, and the commonest reason to type
  // here is to go and solve something, so the term is carried to the catalog.
  const openCatalog = (term) => {
    if (term) navigate(`/problems?search=${encodeURIComponent(term)}`);
  };

  return (
    <AppShell
      title="Dashboard"
      search={{ placeholder: 'Search problems…', onSubmit: openCatalog }}
    >
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
                <RecentSubmissions username={user?.username} />
                <ActivityHeatmap username={user?.username} />
              </div>
              <div className="col-rail">
                <DailyChallenge />
                <MyContests />
                <PastContests username={user?.username} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
