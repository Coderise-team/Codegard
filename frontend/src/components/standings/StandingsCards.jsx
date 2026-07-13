import { memo, useEffect, useRef, useState } from 'react';
import Icons from '../Icons';

export function TierSelect({ ranks, value, onChange }) {
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

  const opts = [{ name: 'All', color: null }, ...ranks.slice().reverse()];
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

function Medal({ rank }) {
  if (rank <= 3) return <span className={`medal m${rank}`}>{rank}</span>;
  return <span className="rn">{rank}</span>;
}

export const StandingRow = memo(function StandingRow({ u, rowRef }) {
  return (
    <div ref={rowRef || null} className={`st-row${u.you ? ' you' : ''}`}>
      <div className="st-rank">
        <Medal rank={u.rank} />
      </div>

      <div className="st-user">
        <div className="st-av">{u.initials}</div>
        <div className="st-id">
          <div className="st-h">
            <span className="nm">{u.handle}</span>
            {u.you && <span className="you-tag">YOU</span>}
          </div>
        </div>
      </div>

      <div className="st-c st-tier-c">
        <TierBadge name={u.tier} color={u.tierColor} />
      </div>
      <div className="st-c num st-rating">{u.rating}</div>
      <div className="st-c num">
        <Delta d={u.delta} />
      </div>
      <div className="st-c num st-max">{u.maxRating}</div>
    </div>
  );
});

export function PodiumCard({ u, place }) {
  return (
    <div className={`pod pod-${place}${u.you ? ' you' : ''}`}>
      <div className="pod-medal">{place}</div>
      <div className="pod-av">{u.initials}</div>
      <div className="pod-h">
        <span className="nm">{u.handle}</span>
        {u.you && <span className="you-tag">YOU</span>}
      </div>
      <TierBadge name={u.tier} color={u.tierColor} />
      <div className="pod-rating">{u.rating}</div>
      <div className="pod-sub">
        <Delta d={u.delta} />
        <span className="pod-max">
          max <b>{u.maxRating}</b>
        </span>
      </div>
    </div>
  );
}

export function StHead({ sort, onSort }) {
  const arrow = (key) =>
    sort.key === key ? (
      <span className="ar">{sort.dir === 'asc' ? '↑' : '↓'}</span>
    ) : null;

  const Btn = (key, label, num) => (
    <button
      className={`sth${num ? ' num' : ''}${sort.key === key ? ' active' : ''}`}
      onClick={() => onSort(key)}
    >
      {label}
      {arrow(key)}
    </button>
  );

  return (
    <div className="st-headrow">
      {Btn('rank', 'Rank')}
      <span className="sth-static">User</span>
      <span className="sth-static">Tier</span>
      {Btn('rating', 'Rating', true)}
      {Btn('delta', 'Last Δ', true)}
      {Btn('max', 'Max', true)}
    </div>
  );
}
