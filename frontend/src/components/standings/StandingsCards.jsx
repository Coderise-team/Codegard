import { memo, useEffect, useRef, useState } from 'react';
import Avatar from '../Avatar';
import Icons from '../Icons';
import { CG_RANKS, cgRankFor } from '../../utils/ranks';

// How many places the podium covers. A place, not a person: dense ranking lets
// several coders share one, so the podium can hold more than three of them.
export const PODIUM_PLACES = 3;

// How long a podium tile holds one coder before rotating to the next one
// sharing that place.
const PODIUM_ROTATE_MS = 4000;

/**
 * The revolver chevron. Drawn rather than taken from Icons because it has to
 * stretch: `preserveAspectRatio="none"` lets it fill its tall, narrow rail, so
 * the arms reach the corners and the angle opens up. The stroke is kept even
 * by `vectorEffect`, which the stretch would otherwise squash.
 */
function RevolverChevron() {
  return (
    <svg
      viewBox="0 0 10 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points="1.5,2 8.5,50 1.5,98"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

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

/**
 * Last rating change. A dash means the API sent null — no rated contest yet.
 * A plain 0 means a contest that moved nothing: different fact, different mark.
 */
export function Delta({ d }) {
  if (d == null) return <span className="st-delta flat">·</span>;
  if (d === 0) return <span className="st-delta flat">0</span>;
  const up = d > 0;
  return (
    <span className={`st-delta ${up ? 'up' : 'down'}`}>
      {up ? <Icons.arrowUp size={13} /> : <Icons.arrowDown size={13} />}
      {Math.abs(d)}
    </span>
  );
}

// A medal for every place the podium covers, plain digits below it. Places are
// dense-ranked, so ties share a place AND its medal: three tied leaders all wear
// gold, and place 3 may then simply not exist.
function Medal({ place }) {
  if (place <= PODIUM_PLACES) {
    return <span className={`medal m${place}`}>{place}</span>;
  }
  return <span className="rn">{place}</span>;
}

export const StandingRow = memo(function StandingRow({
  u,
  metric = 'rating',
  isYou,
  rowRef,
  onOpen,
}) {
  const tier = cgRankFor(u.elo_rating);
  // Cells keep their place; `by-max` only swaps which number is loud, so the
  // column you sorted by is the one you read.
  const cls = `st-row${isYou ? ' you' : ''}${metric === 'max' ? ' by-max' : ''}`;
  return (
    <div
      ref={rowRef || null}
      className={cls}
      onClick={() => onOpen?.(u.username)}
    >
      <div className="st-rank">
        <Medal place={u.globalRank} />
      </div>

      <div className="st-user">
        <Avatar src={u.avatar} username={u.username} className="st-av" />
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
      <div className="st-c num st-delta-c">
        <Delta d={u.delta} />
      </div>
      <div className="st-c num st-max">{u.maxRating ?? '—'}</div>
    </div>
  );
});

/**
 * One podium tile. A tile is a PLACE, not a person: ties share a place, so
 * `users` can hold several coders. When it does, the tile cycles through them
 * on a timer and offers arrows to page through by hand.
 */
export function PodiumCard({
  place,
  users,
  metric = 'rating',
  youUsername,
  cardRef,
  onOpen,
}) {
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

  // The number the table is ranked by takes the big slot; the other one drops
  // to the sub-line under it, so the tile always leads with what you sorted on.
  const byMax = metric === 'max';
  const lead = byMax ? u.maxRating : u.elo_rating;
  const trail = byMax ? u.elo_rating : u.maxRating;

  const cls = `pod pod-${place}${isYou ? ' you' : ''}${many ? ' has-rev' : ''}`;

  return (
    <div
      ref={cardRef || null}
      className={cls}
      onClick={() => onOpen?.(u.username)}
    >
      <div className="pod-medal">{place}</div>
      <Avatar src={u.avatar} username={u.username} className="pod-av" />
      <div className="pod-h">
        <span className="nm">{u.username}</span>
        {isYou && <span className="you-tag">YOU</span>}
      </div>
      <TierBadge name={tier.name} color={tier.color} />
      <div className="pod-rating">{lead ?? '—'}</div>
      <div className="pod-sub">
        <Delta d={u.delta} />
        <span className="pod-max">
          {byMax ? 'rating' : 'max'} <b>{trail ?? '—'}</b>
        </span>
      </div>

      {many && (
        <>
          {/* the tile itself opens a profile, so paging must not bubble up */}
          <button
            className="pod-arw prev"
            aria-label="Previous coder"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => i + users.length - 1);
            }}
          >
            <RevolverChevron />
          </button>
          <button
            className="pod-arw next"
            aria-label="Next coder"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => i + 1);
            }}
          >
            <RevolverChevron />
          </button>
          <div className="pod-rev">
            <span className="pod-rev-n">
              {pos + 1}/{users.length}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Column headers. Only Rating and Max are sortable — the server orders by those
 * two fields alone. Rank is not a sort key of its own (it IS the order of the
 * active field), and there is no ordering by Last Δ. A board is always sorted by
 * something, so one column is always lit.
 */
export function StHead({ sort, onSort }) {
  const arrow = (key) =>
    sort.key === key ? (
      <span className="ar">{sort.dir === 'asc' ? '↑' : '↓'}</span>
    ) : null;

  // The modifier class lets the phone layout park each button over the column
  // it orders, once the labels around it are gone.
  const Btn = (key, label) => (
    <button
      className={`sth num sth-${key}${sort.key === key ? ' active' : ''}`}
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
