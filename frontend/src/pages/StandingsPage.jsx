import { useState, useMemo, useRef } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Icons from '../components/Icons';
import {
  TierSelect,
  StandingRow,
  PodiumCard,
  StHead,
} from '../components/standings/StandingsCards';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useStandings } from '../hooks/useStandings';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useRowPosition } from '../hooks/useRowPosition';
import './StandingsPage.css';

// The podium holds the first three PLACES, not the first three people: dense
// ranking lets several coders share a place.
const PODIUM_PLACES = 3;

// Sort column -> API ordering field ('-' prefix for descending).
const ORDER_FIELD = { rating: 'elo_rating', max: 'max_rating' };

/** StandingsPage — the global ELO leaderboard. */
export default function StandingsPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  const [tier, setTier] = useState('All');
  const [sort, setSort] = useState({ key: 'rating', dir: 'desc' });

  const canvasRef = useRef(null);
  // The floating bar docks to whichever edge your own row went past.
  const [youVis, youRowRef] = useRowPosition(canvasRef);

  // "All" means no tier param at all; the server maps a tier name to its rating
  // band itself (the ladder lives in RANK_THRESHOLDS there, in CG_RANKS here).
  const params = useMemo(
    () => ({
      ordering: `${sort.dir === 'desc' ? '-' : ''}${ORDER_FIELD[sort.key]}`,
      ...(tier !== 'All' && { tier }),
    }),
    [sort, tier]
  );
  const { items, count, total, you, hasMore, loading, error, loadMore } =
    useStandings(params);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore);

  // A new column starts descending — best first is what you want to see.
  const onSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    );

  // Ascending order drags the top places to the very end of the list, where the
  // podium would sit empty until you scrolled all the way down — so hide it.
  const showPodium = sort.dir === 'desc';

  // One tile per PLACE, holding everyone who shares it.
  const podium = useMemo(() => {
    const byPlace = new Map();
    for (const u of items) {
      if (u.globalRank > PODIUM_PLACES) continue;
      const group = byPlace.get(u.globalRank) ?? [];
      group.push(u);
      byPlace.set(u.globalRank, group);
    }
    return [...byPlace.entries()]
      .sort(([a], [b]) => a - b)
      .map(([place, users]) => ({ place, users }));
  }, [items]);

  // The podium consumes the top places; without it they stay in the list.
  const rows = showPodium
    ? items.filter((u) => u.globalRank > PODIUM_PLACES)
    : items;
  const isYou = (u) => u.username === user?.username;

  // Your own entry lives either on the podium or in the list, never both — and
  // the floating bar has to hide once EITHER of them is on screen, so the
  // tracker follows whichever one holds you. On the podium that's the tile for
  // your place, even while it is revolving through someone else.
  const youPlace = showPodium
    ? podium.find(({ users }) => users.some(isYou))?.place
    : undefined;

  // A count we don't have yet is simply not shown — never a placeholder zero.
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : null);

  return (
    <div className="dash st-page" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
          title="Standings"
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="canvas scroll" ref={canvasRef}>
          <div className="canvas-in">
            <div className="st-head">
              <h1>Global Standings</h1>
              {total != null && (
                <span className="sub">
                  <b>{fmt(total)}</b> coders
                </span>
              )}
            </div>

            <div className="st-controls">
              <TierSelect value={tier} onChange={setTier} />
              {count != null && (
                <div className="st-count">
                  <b>{fmt(count)}</b> shown
                </div>
              )}
            </div>

            {showPodium && podium.length > 0 && (
              <div className="podium">
                {podium.map(({ place, users }) => (
                  <PodiumCard
                    key={place}
                    place={place}
                    users={users}
                    youUsername={user?.username}
                    cardRef={place === youPlace ? youRowRef : null}
                  />
                ))}
              </div>
            )}

            {error ? (
              <div className="st-empty">
                <div className="ei">
                  <Icons.x size={20} />
                </div>
                <div className="et">Standings unavailable</div>
                <div className="es">
                  The leaderboard could not be loaded. Try again later.
                </div>
              </div>
            ) : !loading && items.length === 0 ? (
              <div className="st-empty">
                <div className="ei">
                  <Icons.search size={20} />
                </div>
                <div className="et">No coders found</div>
                <div className="es">Try a different tier filter.</div>
              </div>
            ) : (
              <>
                <StHead sort={sort} onSort={onSort} />
                <div className="st-list">
                  {rows.map((u) => (
                    <StandingRow
                      key={u.username}
                      u={u}
                      isYou={isYou(u)}
                      rowRef={isYou(u) ? youRowRef : null}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="st-more" ref={sentinelRef}>
                    <span className="sp" />
                    Loading more…
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* "your standing" — overlay, position tracks your row */}
        {you && youVis !== 'visible' && (
          <div className={`st-youbar ${youVis}`}>
            <div className="st-youbar-in">
              <div className="lbl">Your standing</div>
              <StandingRow u={you} isYou />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
