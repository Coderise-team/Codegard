import Icons from '../Icons';

/**
 * ProfileRing — ELO ring card (rank-tinted) with progress toward the next tier.
 *
 * Props:
 *   user — { elo_rating, rank, nextTier }, nextTier: { name, floor, ceil } | null
 */
export default function ProfileRing({ user }) {
  const I = Icons;
  const R = 84,
    C = 2 * Math.PI * R;
  const nt = user.nextTier;
  const frac = nt
    ? Math.max(
        0,
        Math.min(1, (user.elo_rating - nt.floor) / (nt.ceil - nt.floor))
      )
    : 1;
  const off = C * (1 - frac);
  const toNext = nt ? Math.max(0, nt.ceil - user.elo_rating) : 0;

  return (
    <section className="card pring-card">
      <div className="card-hd">
        <span className="t">
          <I.award size={16} /> Rating
        </span>
      </div>
      <div className="card-bd">
        <div className="ring-wrap">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="pRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--rank-hi)" />
                <stop offset="1" stopColor="var(--rank-c)" />
              </linearGradient>
            </defs>
            <circle
              className="track"
              cx="100"
              cy="100"
              r={R}
              strokeWidth="13"
            />
            <circle
              className="meter"
              cx="100"
              cy="100"
              r={R}
              strokeWidth="13"
              strokeDasharray={C}
              strokeDashoffset={off}
            />
          </svg>
          <div className="ring-center">
            <div className="elo">{user.elo_rating}</div>
            <div className="lab">ELO Rating</div>
            <div className="rk">{user.rank}</div>
          </div>
        </div>
        <div className="tier-line">
          <div className="lbl">
            <span>{user.rank}</span>
            <span>
              {nt ? (
                <>
                  {toNext} to <b>{nt.name}</b>
                </>
              ) : (
                'top tier'
              )}
            </span>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${frac * 100}%` }}></div>
          </div>
        </div>
      </div>
    </section>
  );
}
