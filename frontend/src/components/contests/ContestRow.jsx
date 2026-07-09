import Icons from '../Icons';
import { fmtCountdown, formatDuration } from '../../utils/time';

const I = Icons;

/**
 * ContestRow — one full-width row-card in the upcoming-contests list.
 *
 * Keeps the mock card's elements (calendar chip, "starts in" timer, register
 * pill) but lays them out as a single horizontal row.
 *
 * The whole card is clickable (opens the contest); the register button stops
 * propagation so it only toggles registration.
 *
 * Props:
 *   c          — pending contest { id, title, start_time, end_time,
 *                problems_count, participants_count }
 *   now        — current time in ms, ticked by the parent (drives the countdown)
 *   registered — effective joined state (parent may override optimistically)
 *   onToggle   — register / unregister toggle
 *   onOpen     — open the contest
 *   soon       — highlight as the nearest contest
 */
export default function ContestRow({
  c,
  now,
  registered,
  onToggle,
  onOpen,
  soon,
}) {
  const start = new Date(c.start_time);
  const startsIn = Math.max(0, Math.round((start.getTime() - now) / 1000));
  return (
    <article
      className={`ct-row${soon ? ' is-soon' : ''}`}
      onClick={() => onOpen(c)}
    >
      <div className="cr-cal">
        <span className="d">{start.getDate()}</span>
        <span className="mo">
          {start.toLocaleString('en', { month: 'short' })}
        </span>
      </div>

      <div className="cr-main">
        <div className="cr-name">{c.title}</div>
        <div className="cr-meta">
          <span>
            <I.clock size={14} /> {formatDuration(c.start_time, c.end_time)}
          </span>
          <span>
            <I.grid size={13} /> {c.problems_count} problems
          </span>
          <span>
            <I.users size={14} /> {c.participants_count.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="cr-count">
        <span className="k">Starts in</span>
        <span className="v">{fmtCountdown(startsIn)}</span>
      </div>

      <div className="cr-actions">
        {registered ? (
          <button
            className="reg-pill done"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(c);
            }}
          >
            <I.checkBold size={13} /> Registered
          </button>
        ) : (
          <button
            className="reg-pill go"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(c);
            }}
          >
            <I.flag size={13} /> Register
          </button>
        )}
      </div>
    </article>
  );
}
