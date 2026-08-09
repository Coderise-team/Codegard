import React from 'react';

const TierChip = ({ tier, color, fill = '1A' }) => (
  <span
    className="pd-tier"
    style={{ color, borderColor: `${color}66`, background: color + fill }}
  >
    <i style={{ background: color }} />
    {tier}
  </span>
);

/**
 * Global rating section — the counterpart to the live contest board:
 * static, ranked, with a metallic top-3 podium (semantic gold/silver/bronze,
 * independent of the violet accent), the ranked table below it and the
 * tier ladder as a footer strip.
 */
export default function GlobalStandings({ podium, table, ladder }) {
  const ordinal = (r) => (r === 1 ? '1st' : r === 2 ? '2nd' : '3rd');

  return (
    <section className="sec stand metal" id="rating">
      <div className="wrap">
        <div className="stand-head rv">
          <span className="eyebrow">
            <i />
            Global rating
          </span>
          <h2 className="sec-t">
            A rating is not one round. It is your place among everyone.
          </h2>
          <p className="sec-sub">
            Solve problems, join live contests, watch your rating move. Every
            rated round feeds the same ladder, and the ladder never resets.
          </p>
        </div>

        <div className="podium">
          {podium.map((p, i) => (
            <div key={p.handle} className={`pd pd-${p.rank} rv rv-d${i + 1}`}>
              <span className="pd-rank">{ordinal(p.rank)}</span>
              <span className="pd-av">{p.initials}</span>
              <span className="pd-h">{p.handle}</span>
              <span className="pd-r">{p.rating}</span>
              <TierChip tier={p.tier} color={p.color} />
            </div>
          ))}
        </div>

        <div className="st-table rv rv-d2">
          <div className="st-h">
            <span>#</span>
            <span>Coder</span>
            <span>Tier</span>
            <span className="n">Rating</span>
            <span className="n">Last</span>
          </div>
          {table.map((r) => (
            <div key={r.handle} className={`st-r${r.you ? ' me' : ''}`}>
              <span className="rk">{r.rank}</span>
              <span className="bu">
                <span
                  className="bav"
                  style={
                    r.you
                      ? undefined
                      : {
                          background: `linear-gradient(150deg, ${r.color}, ${r.color}AA)`,
                        }
                  }
                >
                  {r.initials}
                </span>
                <span className="bh">
                  {r.handle}
                  {r.you ? (
                    <span className="you-tag" style={{ marginLeft: 8 }}>
                      YOU
                    </span>
                  ) : null}
                </span>
              </span>
              <TierChip tier={r.tier} color={r.color} fill="14" />
              <span className="n rt" style={{ color: r.color }}>
                {r.rating}
              </span>
              <span className={`n dl ${r.delta > 0 ? 'up' : 'dn'}`}>
                {r.delta > 0 ? '+' : ''}
                {r.delta}
              </span>
            </div>
          ))}
          <div className="st-foot">
            <a href="/standings">Open the full leaderboard</a>
          </div>
        </div>

        <div className="ladder rv rv-d3">
          {ladder.map((t) => (
            <div key={t.name} className="lad">
              <span className="nm">
                <i style={{ background: t.color }} />
                {t.name}
              </span>
              <span className="rg" style={{ display: 'block' }}>
                {t.min}+
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
