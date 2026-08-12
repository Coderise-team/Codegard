import Icons from '../Icons';

/** Tier pill, built the way StandingsCards builds it: dot, name, tinted edge. */
function TierBadge({ name, color }) {
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

/** Last rating change, with the arrow the standings page draws. */
function Delta({ d }) {
  const up = d > 0;
  return (
    <span className={`st-delta ${up ? 'up' : 'down'}`}>
      {up ? <Icons.arrowUp size={13} /> : <Icons.arrowDown size={13} />}
      {Math.abs(d)}
    </span>
  );
}

/**
 * Global rating section — the counterpart to the live contest board: static,
 * ranked, with the metallic top-three podium, the ranked rows below it and the
 * tier ladder as a footer strip.
 *
 * The podium tiles and the rows follow StandingsCards / StandingsPage.css: a
 * medal for the place, the accent avatar, the tier pill, the rating, its last
 * change and the peak.
 */
export default function GlobalStandings({ podium, table, ladder }) {
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

        {/* One panel around the whole leaderboard, the way the standings page
            holds it, so the podium and the rows read as one surface instead of
            floating on the section background. */}
        <div className="rank-panel rv rv-d1">
          <div className="rank-top">
            <span className="ttl">
              <Icons.trophy size={14} />
              Global standings
            </span>
            <span className="rank-sort">Sorted by rating</span>
          </div>

          <div className="lp-podium">
            {podium.map((p, i) => (
              <div
                key={p.handle}
                className={`pod pod-${p.rank} rv rv-d${i + 1}`}
              >
                <span className="pod-medal">{p.rank}</span>
                <span className="pod-av">{p.initials}</span>
                <span className="pod-h">{p.handle}</span>
                <TierBadge name={p.tier} color={p.color} />
                <span className="pod-rating">{p.rating}</span>
                <span className="pod-sub">
                  <Delta d={p.delta} />
                  <span className="pod-max">
                    max <b>{p.max}</b>
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="rank-rows">
            <div className="rank-h">
              <span>#</span>
              <span>Coder</span>
              <span>Tier</span>
              <span className="num">Rating</span>
              <span className="num">Last</span>
              <span className="num">Max</span>
            </div>

            {table.map((r) => (
              <div key={r.handle} className={`st-row${r.you ? ' you' : ''}`}>
                <span className="rn">{r.rank}</span>
                <span className="st-user">
                  <span className="st-av">{r.initials}</span>
                  <span className="nm">{r.handle}</span>
                  {r.you ? <span className="lp-you-tag">YOU</span> : null}
                </span>
                <span className="st-tier-c">
                  <TierBadge name={r.tier} color={r.color} />
                </span>
                <span className="st-rating num">{r.rating}</span>
                <span className="num">
                  <Delta d={r.delta} />
                </span>
                <span className="st-max num">{r.max}</span>
              </div>
            ))}
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

        <p className="stand-note rv rv-d3">
          Everyone has a tier. You can be a Junior or a Trainee, or you can
          climb all the way to the top and become an Architect, or the Kernel of
          the platform.
        </p>

        <p className="stand-note rv rv-d3">
          We built you a dashboard that holds the whole picture, so you can
          follow your own numbers and your opponents&apos; on their profile
          pages. Look back at the contests you entered, at the attempts you have
          made, and watch your rating move on the chart.
        </p>
      </div>
    </section>
  );
}
