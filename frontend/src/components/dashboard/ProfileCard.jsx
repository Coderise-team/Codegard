import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icons from '../Icons';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../hooks/useProfile';

/**
 * Rating ring — ELO + current rank in the center, with a progress arc toward
 * the next tier around it. `frac` is the fill (0–1); it's 1 at the top tier.
 */
function RatingRing({ rating, rank, frac }) {
  const R = 86;
  const C = 2 * Math.PI * R;
  const off = C * (1 - frac);

  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--gold-hi)" />
            <stop offset="1" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
        <circle className="track" cx="100" cy="100" r={R} strokeWidth="14" />
        <circle
          className="meter"
          cx="100"
          cy="100"
          r={R}
          strokeWidth="14"
          strokeDasharray={C}
          strokeDashoffset={off}
        />
      </svg>
      <div className="ring-center">
        <div className="elo">{rating}</div>
        <div className="lab">ELO Rating</div>
        <div className="rk">{rank}</div>
      </div>
    </div>
  );
}

/** Rating-history sparkline (oldest → newest). Needs at least 2 points. */
function Sparkline({ history }) {
  const W = 300,
    H = 56,
    pad = 4;
  const rs = history.map((h) => h.rating);
  const min = Math.min(...rs),
    max = Math.max(...rs);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (history.length - 1);
  const y = (r) => pad + (1 - (r - min) / span) * (H - 2 * pad);
  const line = history
    .map(
      (h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(h.rating).toFixed(1)}`
    )
    .join(' ');
  const area = `${line} L${x(history.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const last = history[history.length - 1];

  return (
    <div className="spark">
      <div className="shd">
        <span className="k">Rating · last {history.length}</span>
        <span className="v">
          {min}–{max}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="ar" d={area} />
        <path className="ln" d={line} vectorEffect="non-scaling-stroke" />
        <circle
          className="dot-now"
          cx={x(history.length - 1)}
          cy={y(last.rating)}
          r="3.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * ProfileCard — the authenticated user's standing: ELO ring with progress to the
 * next tier, global rank / max rating, a tier-progress bar and a rating sparkline.
 */
export default function ProfileCard() {
  const username = useAuthStore((s) => s.user?.username);
  const { data, loading, error } = useProfile(username);

  // Delta = change between the two latest rating points (computed on the fly).
  const delta = useMemo(() => {
    const h = data?.history;
    if (!h || h.length < 2) return null;
    return h[h.length - 1].rating - h[h.length - 2].rating;
  }, [data]);

  // Progress within the current tier band (0–1); full at the top tier (no next).
  const frac = useMemo(() => {
    const nt = data?.user?.nextTier;
    if (!nt) return 1;
    const f = (data.user.elo_rating - nt.floor) / (nt.ceil - nt.floor);
    return Math.max(0, Math.min(1, f));
  }, [data]);

  return (
    <section className="card profile">
      <div className="card-hd">
        <span className="t">
          <Icons.award size={16} /> Your standing
        </span>
        <Link className="more" to={username ? `/users/${username}` : '/'}>
          Profile <Icons.chevRight size={13} />
        </Link>
      </div>

      {loading && <div className="list-msg">Loading…</div>}
      {error && <div className="list-msg">Couldn’t load profile.</div>}

      {data && (
        <div className="card-bd">
          <RatingRing
            rating={data.user.elo_rating}
            rank={data.user.rank}
            frac={frac}
          />
          <div className="pmeta">
            <div className="pname">
              {data.user.username}
              {delta != null && (
                <span className={`pdelta ${delta >= 0 ? 'up' : 'down'}`}>
                  {delta >= 0 ? (
                    <Icons.arrowUp size={12} />
                  ) : (
                    <Icons.arrowDown size={12} />
                  )}
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </span>
              )}
            </div>

            <div className="ptier">
              Global rank <b>#{data.user.globalRank}</b> · max{' '}
              {data.user.maxRating}
            </div>

            {data.user.nextTier && (
              <div className="tier-bar">
                <div className="lbl">
                  <span>{data.user.nextTier.floor}</span>
                  <span>→ {data.user.nextTier.name}</span>
                  <span>{data.user.nextTier.ceil}</span>
                </div>
                <div className="track">
                  <div className="fill" style={{ width: `${frac * 100}%` }} />
                </div>
              </div>
            )}

            {data.history.length >= 2 && <Sparkline history={data.history} />}
          </div>
        </div>
      )}
    </section>
  );
}
