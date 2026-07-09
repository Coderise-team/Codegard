import Icons from '../Icons';

const I = Icons;

/**
 * PastRow — one full-width row-card in the past-contests list. Reuses the same
 * card shell, styles and hover as the upcoming ContestRow; the whole card is
 * clickable. Keeps the past-specific elements: date + year, participants,
 * problem count and the "Results" affordance.
 *
 * Props:
 *   c      — finished contest { id, title, end_time, participants_count, problems_count }
 *   onOpen — open the contest results
 */
export default function PastRow({ c, onOpen }) {
  const end = new Date(c.end_time);
  return (
    <article className="ct-row is-past" onClick={() => onOpen(c)}>
      <div className="cr-cal">
        <span className="d">{end.getDate()}</span>
        <span className="mo">
          {end.toLocaleString('en', { month: 'short' })}
        </span>
      </div>

      <div className="cr-main">
        <div className="cr-name">{c.title}</div>
        <div className="cr-meta">
          <span>{end.getFullYear()}</span>
          <span>
            <I.users size={14} /> {c.participants_count.toLocaleString()}
          </span>
          <span>
            <I.grid size={13} /> {c.problems_count} problems
          </span>
        </div>
      </div>

      <span className="cr-results">
        Results <I.chevRight size={15} />
      </span>
    </article>
  );
}
