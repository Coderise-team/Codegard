import Icons from '../Icons';
import { CG_RANKS } from '../../data/profileData';

/**
 * RatingChart — large rating-over-time area chart with rank bands.
 *
 * Props:
 *   data — profile object ({ ratingHistory: [{ c, r, d }], user })
 */
export default function RatingChart({ data }) {
  const hist = data.ratingHistory;
  const u = data.user;
  const W = 720,
    H = 248,
    padL = 46,
    padR = 14,
    padT = 16,
    padB = 26;
  const rs = hist.map((h) => h.r);
  const dmin = Math.min(...rs),
    dmax = Math.max(...rs);
  const lo = Math.floor((dmin - 60) / 100) * 100;
  const hi = Math.ceil((dmax + 60) / 100) * 100;
  const x = (i) => padL + (i * (W - padL - padR)) / (hist.length - 1);
  const y = (r) => padT + (1 - (r - lo) / (hi - lo)) * (H - padT - padB);

  const line = hist
    .map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(h.r).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(hist.length - 1).toFixed(1)} ${y(lo)} L${x(0).toFixed(1)} ${y(lo)} Z`;

  // y gridlines (rounded steps)
  const ticks = [];
  const stepCount = 4;
  for (let i = 0; i <= stepCount; i++)
    ticks.push(Math.round(lo + ((hi - lo) * i) / stepCount));

  // rank bands visible in [lo,hi]
  const bands = CG_RANKS.map((rk, i) => {
    const top = i < CG_RANKS.length - 1 ? CG_RANKS[i + 1].min : hi;
    const a = Math.max(lo, rk.min),
      b = Math.min(hi, top);
    return b > a ? { name: rk.name, color: rk.color, a, b } : null;
  }).filter(Boolean);

  const peakI = rs.indexOf(dmax);

  return (
    <section className="card chart-card">
      <div className="card-hd">
        <span className="t">
          <Icons.chart size={16} /> Rating progress
        </span>
        <div className="cmeta">
          <div className="m">
            <div className="k">Current</div>
            <div className="v" style={{ color: 'var(--rank-c)' }}>
              {u.rating}
            </div>
          </div>
          <div className="m">
            <div className="k">Peak</div>
            <div className="v">{u.maxRating}</div>
          </div>
          <div className="m">
            <div className="k">Contests</div>
            <div className="v">{hist.length}</div>
          </div>
        </div>
      </div>
      <div className="card-bd">
        <div className="rchart">
          <svg viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <linearGradient id="rcFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--gold)" stopOpacity="0.26" />
                <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* rank bands */}
            {bands.map((bd) => (
              <g key={bd.name}>
                <rect
                  className="band"
                  x={padL}
                  y={y(bd.b)}
                  width={W - padL - padR}
                  height={Math.max(0, y(bd.a) - y(bd.b))}
                  fill={bd.color}
                  fillOpacity="0.07"
                />
                {y(bd.a) - y(bd.b) > 22 && (
                  <text
                    className="bandlab"
                    x={W - padR - 5}
                    y={y(bd.b) + 13}
                    textAnchor="end"
                    fill={bd.color}
                    fillOpacity="0.7"
                  >
                    {bd.name}
                  </text>
                )}
              </g>
            ))}
            {/* gridlines + y labels */}
            {ticks.map((tk) => (
              <g key={tk}>
                <line
                  className="grid-l"
                  x1={padL}
                  y1={y(tk)}
                  x2={W - padR}
                  y2={y(tk)}
                />
                <text
                  className="grid-t"
                  x={padL - 8}
                  y={y(tk) + 3}
                  textAnchor="end"
                >
                  {tk}
                </text>
              </g>
            ))}
            {/* area + line */}
            <path className="area" d={area} />
            <path className="line" d={line} vectorEffect="non-scaling-stroke" />
            {/* points */}
            {hist.map((h, i) => {
              const isLast = i === hist.length - 1;
              const isPeak = i === peakI;
              const fill = isLast
                ? 'var(--gold-hi)'
                : h.d == null
                  ? 'var(--fg2)'
                  : h.d >= 0
                    ? 'var(--ac)'
                    : 'var(--wa)';
              return (
                <circle
                  key={i}
                  className="pt"
                  cx={x(i)}
                  cy={y(h.r)}
                  r={isLast || isPeak ? 4.6 : 3}
                  fill={fill}
                />
              );
            })}
            {/* peak marker */}
            <circle
              cx={x(peakI)}
              cy={y(dmax)}
              r="7.5"
              fill="none"
              stroke="var(--gold-hi)"
              strokeWidth="1.2"
              strokeOpacity="0.6"
            />
          </svg>
        </div>
        <div className="rchart-foot">
          <span>
            {hist[0].c.split(' #')[0]} → {hist[hist.length - 1].c}
          </span>
          <span className="legend">
            <span className="lg">
              <i style={{ background: 'var(--ac)' }}></i> Gain
            </span>
            <span className="lg">
              <i style={{ background: 'var(--wa)' }}></i> Drop
            </span>
            <span className="lg">
              <i style={{ background: 'var(--gold-hi)' }}></i> Peak / latest
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
