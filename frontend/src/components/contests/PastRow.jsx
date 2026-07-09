import Icons from '../Icons';
import { formatDate } from '../../utils/time';

const I = Icons;

/**
 * PastRow — one row in the past-contests results list.
 *
 * Props:
 *   c — finished contest { id, title, end_time, participants_count, problems_count }
 */
export default function PastRow({ c }) {
  return (
    <a className="ct-prow" href="#">
      <div className="pr-date">
        <span className="d">{formatDate(c.end_time)}</span>
        <span className="y">{new Date(c.end_time).getFullYear()}</span>
      </div>
      <div className="pr-main">
        <div className="pr-name">{c.title}</div>
        <div className="pr-sub">
          <span className="pr-dim">
            <I.users size={13} /> {c.participants_count.toLocaleString()}
          </span>
          <span className="pr-dim">{c.problems_count} problems</span>
        </div>
      </div>
      <span className="pr-results">
        Results <I.chevRight size={15} />
      </span>
    </a>
  );
}
