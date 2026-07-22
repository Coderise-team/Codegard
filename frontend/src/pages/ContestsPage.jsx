import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import { ContestHeroView } from '../components/dashboard/ContestHero';
import ContestRow from '../components/contests/ContestRow';
import PastRow from '../components/contests/PastRow';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useContestHero } from '../hooks/useContestHero';
import { useContests } from '../hooks/useContests';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { joinContest, leaveContest } from '../api/contests';
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
  // default -start_time order (freshest first); Upcoming asks for ascending
  // start_time (nearest first).
  const params = useMemo(
    () =>
      tab === 'past'
        ? { status: 'finished' }
        : { status: 'pending', ordering: 'start_time' },
    [tab]
  );
  const { items, total, hasMore, loading, loadMore } = useContests(params);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore);

  // The featured hero (when "soon") is the nearest pending contest — the same
  // one that would head the Upcoming list. Lift the hook here so we can render
  // the hero AND drop that contest from the list to avoid the duplicate.
  const hero = useContestHero();
  const featuredId =
    hero.state === 'soon' ? (hero.data?.contest?.id ?? null) : null;
  const upcoming =
    featuredId == null ? items : items.filter((c) => c.id !== featuredId);
  const upcomingCount = Math.max(0, total - (featuredId == null ? 0 : 1));

  // A ticking clock kept in state and passed down to the rows. The React
  // Compiler memoises rows by their props, so a row reading Date.now() itself
  // would be cached forever — the countdown has to depend on a prop that
  // actually changes each second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (tab !== 'upcoming') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tab]);

  const navigate = useNavigate();
  const openContest = (c) => navigate(`/contests/${c.id}`);

  // Optimistic registration: flip locally, call the API, revert on failure.
  const [regOverride, setRegOverride] = useState({}); // contest id -> joined
  const isRegistered = (c) => regOverride[c.id] ?? c.is_joined;
  const toggleReg = async (c) => {
    const joined = isRegistered(c);
    setRegOverride((m) => ({ ...m, [c.id]: !joined }));
    try {
      await (joined ? leaveContest(c.id) : joinContest(c.id));
    } catch {
      setRegOverride((m) => ({ ...m, [c.id]: joined }));
    }
  };

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

            <ContestHeroView {...hero} />

            <div className="ct-bar">
              <div className="ct-tabs">
                <button
                  className={`ct-tab${tab === 'upcoming' ? ' is-active' : ''}`}
                  onClick={() => setTab('upcoming')}
                >
                  Upcoming
                  {tab === 'upcoming' && (
                    <span className="cnt">{upcomingCount}</span>
                  )}
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

            {tab === 'upcoming' &&
              (upcoming.length ? (
                <>
                  <div className="ct-list">
                    {upcoming.map((c, i) => (
                      <ContestRow
                        key={c.id}
                        c={c}
                        now={now}
                        registered={isRegistered(c)}
                        onToggle={toggleReg}
                        onOpen={openContest}
                        soon={featuredId == null && i === 0}
                      />
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
                <div className="ct-empty">
                  <div className="et">No upcoming contests</div>
                  <div className="es">
                    New rounds will show up here once scheduled.
                  </div>
                </div>
              ))}

            {tab === 'past' &&
              (items.length ? (
                <>
                  <div className="ct-list">
                    {items.map((c) => (
                      <PastRow key={c.id} c={c} onOpen={openContest} />
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
                <div className="ct-empty">
                  <div className="et">No past contests yet</div>
                  <div className="es">Finished rounds will show up here.</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
