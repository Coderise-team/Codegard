import { StatusIcon } from './bits';

/**
 * ProblemCards — card-grid view.
 *
 * Props:
 *   rows            — problems to render (current page)
 *   onOpen(problem) — card click
 *   onTag(tag)      — tag chip click
 */
export default function ProblemCards({ rows, onOpen, onTag }) {
  return (
    <div className="pcards">
      {rows.map((p, i) => (
        <div
          key={p.id}
          className="pcard"
          style={{ animationDelay: `${(i % 20) * 40}ms` }}
          onClick={() => onOpen(p)}
        >
          <div className="pc-top">
            <span className="pc-id">{p.id}</span>
            <span className={`df d-${p.difficulty.toLowerCase()}`}>
              {p.difficulty}
            </span>
          </div>
          <div className="pc-title">{p.title}</div>
          <div className="pc-tags">
            {p.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="tag"
                onClick={(e) => {
                  e.stopPropagation();
                  onTag(t);
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="pc-foot">
            <span className="pc-acc">{p.acceptance.toFixed(1)}% AC</span>
            <span className={`pc-st ${p.status}`}>
              <StatusIcon status={p.status} size={13} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
