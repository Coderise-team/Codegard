import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Icons from '../components/Icons';
import {
  TierSelect,
  StandingRow,
  PodiumCard,
  StHead,
  PODIUM_PLACES,
} from '../components/standings/StandingsCards';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useStandings } from '../hooks/useStandings';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useRowPosition } from '../hooks/useRowPosition';
import './StandingsPage.css';

// Sort column -> API ordering field ('-' prefix for descending).
const ORDER_FIELD = { rating: 'elo_rating', max: 'max_rating' };

/** StandingsPage — the global ELO leaderboard. */
export default function StandingsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const [tier, setTier] = useState('All');
  // null = the server's own default order (best rating first).
  const [sort, setSort] = useState(null);

  const canvasRef = useRef(null);
  // The floating bar docks to whichever edge your own row went past.
  const [youVis, youRowRef] = useRowPosition(canvasRef);

  // Params the server does not need are left out entirely: no sort means no
  // `ordering` (it falls back to its own default), "All" means no `tier`. The
  // server maps a tier name to its rating band itself (the ladder lives in
  // RANK_THRESHOLDS there, in CG_RANKS here).
  const params = useMemo(() => {
    const p = {};
    if (sort)
      p.ordering = `${sort.dir === 'desc' ? '-' : ''}${ORDER_FIELD[sort.key]}`;
    if (tier !== 'All') p.tier = tier;
    return p;
  }, [sort, tier]);

  const { items, count, total, you, hasMore, loading, error, loadMore } =
    useStandings(params);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore);

  // Click cycle: descending (best first) -> ascending -> off, back to default.
  const onSort = (key) =>
    setSort((s) => {
      if (s?.key !== key) return { key, dir: 'desc' };
      return s.dir === 'desc' ? { key, dir: 'asc' } : null;
    });

  // Which number the table is ranked by right now; it gets the loud styling.
  const metric = sort?.key === 'max' ? 'max' : 'rating';

  const filtered = tier !== 'All';

  // The podium is a view of the top of the WORLD, so it only belongs on the
  // unfiltered board. Filter by tier and it goes away entirely — even when the
  // world's top three happen to sit in that tier, they show as ordinary rows.
  // Ascending order kills it too: the top places would land at the far end of
  // the list, leaving the podium empty until you scrolled all the way down.
  const showPodium = !filtered && (!sort || sort.dir === 'desc');

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

  // Your own name goes to your own profile — a page that does not exist yet, so
  // the link is dead on purpose and will start working the day /me lands.
  // Memoised: StandingRow is memo()'d, and a fresh handler on every render would
  // re-render every row on the board for nothing.
  const openUser = useCallback(
    (username) =>
      navigate(username === user?.username ? '/me' : `/users/${username}`),
    [navigate, user?.username]
  );

  // Your own entry lives either on the podium or in the list, never both — and
  // the floating bar has to hide once EITHER of them is on screen, so the
  // tracker follows whichever one holds you. On the podium that's the tile for
  // your place, even while it is revolving through someone else.
  const youPlace = showPodium
    ? podium.find(({ users }) => users.some(isYou))?.place
    : undefined;

  const fmt = (n) => n.toLocaleString('en-US');

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
              {/* The one count on the page: the whole board, or how much of it
                  the current tier leaves once you filter. */}
              {total != null && (
                <span className="sub">
                  {filtered && count != null ? (
                    <>
                      showing <b>{fmt(count)}</b> of <b>{fmt(total)}</b> coders
                    </>
                  ) : (
                    <>
                      showing all <b>{fmt(total)}</b> coders
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="st-controls">
              <TierSelect value={tier} onChange={setTier} />
            </div>

            {showPodium && podium.length > 0 && (
              <div className="podium">
                {podium.map(({ place, users }) => (
                  <PodiumCard
                    key={place}
                    place={place}
                    users={users}
                    metric={metric}
                    youUsername={user?.username}
                    cardRef={place === youPlace ? youRowRef : null}
                    onOpen={openUser}
                  />
                ))}
              </div>
            )}

            {/* Only shout when there is nothing to read: a page that failed to
                load MORE rows must not take the rows you already have with it. */}
            {error && items.length === 0 ? (
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
                      metric={metric}
                      isYou={isYou(u)}
                      rowRef={isYou(u) && !youPlace ? youRowRef : null}
                      onOpen={openUser}
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

        {/* "your standing" — overlay, position tracks your row. A tier filter is
            a deliberate search, not a look at where you stand, so the bar stays
            out of it. */}
        {you && !filtered && youVis !== 'visible' && (
          <div className={`st-youbar ${youVis}`}>
            <div className="st-youbar-in">
              <div className="lbl">Your standing</div>
              <StandingRow u={you} metric={metric} isYou onOpen={openUser} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
