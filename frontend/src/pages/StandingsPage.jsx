import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  const [youVis, setYouVis] = useState('below'); // above | visible | below

  const canvasRef = useRef(null);
  const youRowRef = useRef(null);

  // "All" means no tier param at all; the server maps a tier name to its rating
  // band itself (the ladder lives in RANK_THRESHOLDS there, in CG_RANKS here).
  const params = useMemo(
    () => ({
      ordering: `${sort.dir === 'desc' ? '-' : ''}${ORDER_FIELD[sort.key]}`,
      ...(tier !== 'All' && { tier }),
    }),
    [sort, tier]
  );
  const { items, count, total, you, hasMore, loading, loadMore } =
    useStandings(params);

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

  // ---- "your standing" position relative to the viewport ----
  const updateYou = useCallback(() => {
    const canvas = canvasRef.current;
    const row = youRowRef.current;
    if (!canvas || !row) {
      setYouVis('below');
      return;
    }
    const cr = canvas.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    const pad = 56;
    if (rr.bottom < cr.top + pad) setYouVis('above');
    else if (rr.top > cr.bottom - pad) setYouVis('below');
    else setYouVis('visible');
  }, []);

  const onScroll = () => {
    updateYou();
    const el = canvasRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 220) loadMore();
  };

  // recompute the "your standing" position whenever the rendered list changes
  useEffect(() => {
    updateYou();
  }, [items, updateYou]);

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

        <div className="canvas scroll" ref={canvasRef} onScroll={onScroll}>
          <div className="canvas-in">
            <div className="st-head">
              <h1>Global Standings</h1>
              <span className="sub">
                <b>{fmt(total)}</b> coders
              </span>
            </div>

            <div className="st-controls">
              <TierSelect value={tier} onChange={setTier} />
              <div className="st-count">
                <b>{fmt(count)}</b> shown
              </div>
            </div>

            {showPodium && podium.length > 0 && (
              <div className="podium">
                {podium.map(({ place, users }) => (
                  <PodiumCard
                    key={place}
                    place={place}
                    users={users}
                    youUsername={user?.username}
                  />
                ))}
              </div>
            )}

            {!loading && items.length === 0 ? (
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
                  <div className="st-more">
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
