import { useMemo } from 'react';
import Icons from '../Icons';
import { useUserActivity } from '../../hooks/useUserActivity';
import { buildHeatmap } from '../../utils/activity';

const lvl = (c) => (c <= 0 ? 0 : c <= 2 ? 1 : c <= 4 ? 2 : c <= 6 ? 3 : 4);
const DAY_LABEL = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

/** Calendar grid — rendered once the heatmap data is built. */
function Calendar({ activity }) {
  const { weeks, months } = activity;
  const W = weeks.length;

  return (
    <div className="card-bd cal">
      <div className="cal-top">
        <span className="cal-corner" />
        <div className="cal-months">
          {months.map((m, idx) => {
            const next = months[idx + 1] ? months[idx + 1].i : W;
            return (
              <span key={m.i} style={{ width: (next - m.i) * 14 }}>
                {m.label}
              </span>
            );
          })}
        </div>
        <div className="cal-days">
          {[0, 1, 2, 3, 4, 5, 6].map((r) => (
            <span key={r} style={{ gridRow: r + 1 }}>
              {DAY_LABEL[r] || ''}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {weeks.map((w, wi) =>
            [0, 1, 2, 3, 4, 5, 6].map((di) => {
              const cell = w[di];
              return cell ? (
                <i
                  key={`${wi}-${di}`}
                  className={`cc l${lvl(cell.c)}`}
                  title={`${cell.c === 0 ? 'No' : cell.c} submissions · ${cell.t}`}
                />
              ) : (
                <i key={`${wi}-${di}`} className="cc empty" />
              );
            })
          )}
        </div>
      </div>
      <div className="cal-foot">
        <span>{activity.days} active days</span>
        <span className="cf-legend">
          Less <i className="cc l1" />
          <i className="cc l2" />
          <i className="cc l3" />
          <i className="cc l4" /> More
        </span>
      </div>
    </div>
  );
}

/**
 * ActivityHeatmap — GitHub-style year calendar of the given user's submissions
 * per day. The caller owns "whose data". Intensity = submissions that day.
 */
export default function ActivityHeatmap({ username }) {
  const I = Icons;
  const { data: counts, loading, error } = useUserActivity(username);
  const activity = useMemo(
    () => (counts ? buildHeatmap(counts) : null),
    [counts]
  );

  return (
    <section className="card act-card">
      <div className="card-hd">
        <span className="t">
          <I.flame size={16} /> Activity
        </span>
        {activity && (
          <span className="act-sum">
            <b>{activity.total}</b> submissions · 1 yr
          </span>
        )}
      </div>
      {loading && <div className="list-msg">Loading…</div>}
      {error && <div className="list-msg">Couldn’t load activity.</div>}
      {activity && <Calendar activity={activity} />}
    </section>
  );
}
