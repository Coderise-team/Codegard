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
import standingsData from '../data/standingsData';
import './StandingsPage.css';

const PAGE = 20; // infinite-scroll batch size

/** StandingsPage — the global ELO leaderboard. */
export default function StandingsPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  const DATA = standingsData;

  const [tier, setTier] = useState('All');
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' });
  const [visible, setVisible] = useState(PAGE);
  const [youVis, setYouVis] = useState('below'); // above | visible | below

  const canvasRef = useRef(null);
  const youRowRef = useRef(null);

  const onSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'rank' ? 'asc' : 'desc' }
    );

  // ---- filter + sort ----
  const filtered = useMemo(() => {
    const list = DATA.users.filter((u) => tier === 'All' || u.tier === tier);
    const { key, dir } = sort;
    const val = (u) =>
      key === 'rank'
        ? u.rank
        : key === 'rating'
          ? u.rating
          : key === 'delta'
            ? u.delta
            : u.maxRating;
    return [...list].sort((a, b) =>
      dir === 'asc' ? val(a) - val(b) : val(b) - val(a)
    );
  }, [DATA.users, tier, sort]);

  const isDefault = sort.key === 'rank' && sort.dir === 'asc';
  const filtersOn = tier !== 'All' || !isDefault;
  const showPodium = !filtersOn && filtered.length >= 3;

  // the podium consumes the top 3 when shown
  const listSource = showPodium ? filtered.slice(3) : filtered;
  const shown = listSource.slice(0, visible);
  const hasMore = visible < listSource.length;

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
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 220) {
      setVisible((v) => Math.min(v + PAGE, listSource.length));
    }
  };

  // reset paging when the result set changes
  useEffect(() => {
    setVisible(PAGE);
  }, [tier, sort]);

  // recompute the "your standing" position whenever the rendered list changes
  useEffect(() => {
    updateYou();
  }, [visible, showPodium, tier, sort, updateYou]);

  const fmt = (n) => n.toLocaleString('en-US');

  return (
    <div className="dash" data-density="compact">
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
                <b>{fmt(DATA.total)}</b> coders
              </span>
            </div>

            <div className="st-controls">
              <TierSelect ranks={DATA.ranks} value={tier} onChange={setTier} />
              <div className="st-count">
                <b>{fmt(filtered.length)}</b> shown
              </div>
            </div>

            {showPodium && (
              <div className="podium">
                <PodiumCard u={filtered[0]} place={1} />
                <PodiumCard u={filtered[1]} place={2} />
                <PodiumCard u={filtered[2]} place={3} />
              </div>
            )}

            {filtered.length === 0 ? (
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
                  {shown.map((u) => (
                    <StandingRow
                      key={u.handle}
                      u={u}
                      rowRef={u.you ? youRowRef : null}
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
        {DATA.you && youVis !== 'visible' && (
          <div className={`st-youbar ${youVis}`}>
            <div className="st-youbar-in">
              <div className="lbl">Your standing</div>
              <StandingRow u={DATA.you} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
