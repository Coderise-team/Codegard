import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import ContestHero from '../components/dashboard/ContestHero';
import { useCurrentUser } from '../hooks/useCurrentUser';
import './ContestsPage.css';

/**
 * ContestsPage — the contests hub (compact density, violet accent).
 *
 * Featured contest hero on top + Upcoming / Past tabs. Reuses the dashboard
 * shell (Sidebar/Navbar/drawer) and the self-fetching ContestHero.
 */
export default function ContestsPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);
  const [tab, setTab] = useState('upcoming'); // upcoming | past

  return (
    <div className="dash" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
          title="Contests"
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="canvas scroll">
          <div className="ct-hub">
            <div className="ct-head">
              <h1>Contests</h1>
              <span className="sub">
                Compete in rated rounds · climb the rating
              </span>
            </div>

            <ContestHero />

            <div className="ct-bar">
              <div className="ct-tabs">
                <button
                  className={`ct-tab${tab === 'upcoming' ? ' is-active' : ''}`}
                  onClick={() => setTab('upcoming')}
                >
                  Upcoming
                </button>
                <button
                  className={`ct-tab${tab === 'past' ? ' is-active' : ''}`}
                  onClick={() => setTab('past')}
                >
                  Past
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
