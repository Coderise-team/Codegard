import Icons from '../Icons';

/**
 * ProfileRing — ELO ring card (rank-tinted) with progress to next tier.
 *
 * Props:
 *   data — profile object ({ user: { rating, rank: { floor, ceil, name, nextName } } })
 */
export default function ProfileRing({ data }) {
  const I = Icons;
  const u = data.user,
    R = 84,
    C = 2 * Math.PI * R;
  const { floor, ceil, nextName, name } = u.rank;
  const frac = Math.max(0, Math.min(1, (u.rating - floor) / (ceil - floor)));
  const off = C * (1 - frac);
  const toNext = Math.max(0, ceil - u.rating);
  const isTop = nextName === name;

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
            <div className="elo">{u.rating}</div>
            <div className="lab">ELO Rating</div>
            <div className="rk">{name}</div>
          </div>
        </div>
        <div className="tier-line">
          <div className="lbl">
            <span>{name}</span>
            <span>
              {isTop ? (
                'top tier'
              ) : (
                <>
                  {toNext} to <b>{nextName}</b>
                </>
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
