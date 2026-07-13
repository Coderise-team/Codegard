import { memo, useEffect, useRef, useState } from 'react';
import Icons from '../Icons';
import { CG_RANKS, cgRankFor } from '../../utils/ranks';

// Avatar badge fallback: first two letters of the username.
const initialsOf = (username) => username.slice(0, 2).toUpperCase();

// How long a podium tile holds one coder before rotating to the next one
// sharing that place.
const PODIUM_ROTATE_MS = 4000;

export function TierSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  // Highest tier first, with "All" on top.
  const opts = [{ name: 'All', color: null }, ...CG_RANKS.slice().reverse()];
  const cur = opts.find((o) => o.name === value) || opts[0];

  return (
    <div className={`st-tsel${open ? ' open' : ''}`} ref={ref}>
      <button className="st-tsel-btn" onClick={() => setOpen((o) => !o)}>
        <span className="st-tsel-lbl">Filter by tier</span>
        <span className="st-tsel-val">
          {cur.color && <i style={{ background: cur.color }} />}
          {value === 'All' ? 'All tiers' : value}
        </span>
        <span className="st-tsel-chev">
          <Icons.chevDown size={15} />
        </span>
      </button>

      {open && (
        <div className="st-tsel-menu scroll">
          {opts.map((o) => (
            <button
              key={o.name}
              className={`st-tsel-opt${o.name === value ? ' sel' : ''}`}
              onClick={() => {
                onChange(o.name);
                setOpen(false);
              }}
            >
              <i
                className={o.color ? '' : 'all'}
                style={o.color ? { background: o.color } : null}
              />
              <span>{o.name === 'All' ? 'All tiers' : o.name}</span>
              {o.name === value && (
                <span className="ck">
                  <Icons.check size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TierBadge({ name, color }) {
  return (
    <span
      className="st-tier"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
      }}
    >
      <i style={{ background: color }} />
      {name}
    </span>
  );
}

/** Last rating change; null (no rated contest yet) renders as a dash. */
export function Delta({ d }) {
  if (!d) return <span className="st-delta flat">·</span>;
  const up = d > 0;
  return (
    <span className={`st-delta ${up ? 'up' : 'down'}`}>
      {up ? <Icons.arrowUp size={13} /> : <Icons.arrowDown size={13} />}
      {Math.abs(d)}
    </span>
  );
}

// Places are dense-ranked, so ties share a place and a medal: three tied
// leaders all wear gold, and then place 3 may simply not exist.
function Medal({ place }) {
  if (place <= 3) return <span className={`medal m${place}`}>{place}</span>;
  return <span className="rn">{place}</span>;
}

export const StandingRow = memo(function StandingRow({ u, isYou, rowRef }) {
  const tier = cgRankFor(u.elo_rating);
  return (
    <div ref={rowRef || null} className={`st-row${isYou ? ' you' : ''}`}>
      <div className="st-rank">
        <Medal place={u.globalRank} />
      </div>

      <div className="st-user">
        <div className="st-av">{initialsOf(u.username)}</div>
        <div className="st-id">
          <div className="st-h">
            <span className="nm">{u.username}</span>
            {isYou && <span className="you-tag">YOU</span>}
          </div>
        </div>
      </div>

      <div className="st-c st-tier-c">
        <TierBadge name={tier.name} color={tier.color} />
      </div>
      <div className="st-c num st-rating">{u.elo_rating}</div>
      <div className="st-c num">
        <Delta d={u.delta} />
      </div>
      <div className="st-c num st-max">{u.maxRating}</div>
    </div>
  );
});

/**
 * One podium tile. A tile is a PLACE, not a person: ties share a place, so
 * `users` can hold several coders. When it does, the tile cycles through them
 * on a timer and offers arrows to page through by hand.
 */
export function PodiumCard({ place, users, youUsername }) {
  const [idx, setIdx] = useState(0);
  const many = users.length > 1;

  // Pages load in as you scroll, so the group can grow — never index past it.
  const pos = idx % users.length;
  const u = users[pos];

  useEffect(() => {
    if (!many) return undefined;
    // `idx` in the deps restarts the timer after a manual arrow click, so the
    // card doesn't jump on immediately after you paged it yourself.
    const timer = setInterval(() => setIdx((i) => i + 1), PODIUM_ROTATE_MS);
    return () => clearInterval(timer);
  }, [many, idx]);

  const isYou = u.username === youUsername;
  const tier = cgRankFor(u.elo_rating);

  return (
    <div className={`pod pod-${place}${isYou ? ' you' : ''}`}>
      <div className="pod-medal">{place}</div>
      <div className="pod-av">{initialsOf(u.username)}</div>
      <div className="pod-h">
        <span className="nm">{u.username}</span>
        {isYou && <span className="you-tag">YOU</span>}
      </div>
      <TierBadge name={tier.name} color={tier.color} />
      <div className="pod-rating">{u.elo_rating}</div>
      <div className="pod-sub">
        <Delta d={u.delta} />
        <span className="pod-max">
          max <b>{u.maxRating}</b>
        </span>
      </div>

      {many && (
        <div className="pod-rev">
          <button
            className="pod-arw prev"
            aria-label="Previous coder"
            onClick={() => setIdx((i) => i + users.length - 1)}
          >
            <Icons.chevRight size={14} />
          </button>
          <span className="pod-rev-n">
            {pos + 1}/{users.length}
          </span>
          <button
            className="pod-arw"
            aria-label="Next coder"
            onClick={() => setIdx((i) => i + 1)}
          >
            <Icons.chevRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Column headers. Only Rating and Max are sortable — the server orders by
 * those two fields alone. Rank is not a sort key of its own (it IS the order
 * of the active field), and there is no ordering by Last Δ.
 */
export function StHead({ sort, onSort }) {
  const arrow = (key) =>
    sort.key === key ? (
      <span className="ar">{sort.dir === 'asc' ? '↑' : '↓'}</span>
    ) : null;

  const Btn = (key, label) => (
    <button
      className={`sth num${sort.key === key ? ' active' : ''}`}
      onClick={() => onSort(key)}
    >
      {label}
      {arrow(key)}
    </button>
  );

  return (
    <div className="st-headrow">
      <span className="sth-static">Rank</span>
      <span className="sth-static">User</span>
      <span className="sth-static">Tier</span>
      {Btn('rating', 'Rating')}
      <span className="sth-static num">Last Δ</span>
      {Btn('max', 'Max')}
    </div>
  );
}
