import Icons from '../Icons';
import { secondsUntil, fmtCountdown, formatDuration } from '../../utils/time';

const I = Icons;

/**
 * ContestRow — one full-width row-card in the upcoming-contests list.
 *
 * Keeps the mock card's elements (calendar chip, "starts in" timer, register
 * pill, details link) but lays them out as a single horizontal row. The
 * countdown reads the live clock on each render; the parent re-renders every
 * second to keep it ticking.
 *
 * Props:
 *   c          — pending contest { id, title, start_time, end_time,
 *                problems_count, participants_count }
 *   registered — effective joined state (parent may override optimistically)
 *   onToggle   — register / unregister toggle
 *   soon       — highlight as the nearest contest
 */
export default function ContestRow({ c, registered, onToggle, soon }) {
  const start = new Date(c.start_time);
  return (
    <article className={`ct-row${soon ? ' is-soon' : ''}`}>
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
        <span className="v">{fmtCountdown(secondsUntil(c.start_time))}</span>
      </div>

      <div className="cr-actions">
        {registered ? (
          <button className="reg-pill done" onClick={() => onToggle(c)}>
            <I.checkBold size={13} /> Registered
          </button>
        ) : (
          <button className="reg-pill go" onClick={() => onToggle(c)}>
            <I.flag size={13} /> Register
          </button>
        )}
        <a className="cr-link" href="#">
          Details <I.chevRight size={14} />
        </a>
      </div>
    </article>
  );
}
