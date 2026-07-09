import { useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import ContestHero from '../components/dashboard/ContestHero';
import PastRow from '../components/contests/PastRow';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useContests } from '../hooks/useContests';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
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

  // Each tab is a status slice of the same endpoint. Past keeps the server's
  // default -start_time order (freshest first); Upcoming's ascending order is
  // wired in a later step.
  const params = useMemo(
    () => ({ status: tab === 'past' ? 'finished' : 'pending' }),
    [tab]
  );
  const { items, total, hasMore, loading, loadMore } = useContests(params);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore);

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
                  {tab === 'upcoming' && <span className="cnt">{total}</span>}
                </button>
                <button
                  className={`ct-tab${tab === 'past' ? ' is-active' : ''}`}
                  onClick={() => setTab('past')}
                >
                  Past
                  {tab === 'past' && <span className="cnt">{total}</span>}
                </button>
              </div>
            </div>

            {tab === 'past' &&
              (items.length ? (
                <>
                  <div className="ct-past">
                    {items.map((c) => (
                      <PastRow key={c.id} c={c} />
                    ))}
                  </div>
                  {hasMore && (
                    <div
                      ref={sentinelRef}
                      className="ct-sentinel"
                      aria-hidden="true"
                    />
                  )}
                </>
              ) : loading ? null : (
                <div className="ct-past">
                  <div className="ct-empty">
                    <div className="et">No past contests yet</div>
                    <div className="es">Finished rounds will show up here.</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
