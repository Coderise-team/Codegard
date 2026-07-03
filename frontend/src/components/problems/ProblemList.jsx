import Icons from '../Icons';
import { StatusIcon } from './bits';

const I = Icons;

// Sortable columns; each label doubles as a column header in the sort bar.
const COLS = [
  { col: 'id', label: '#' },
  { col: 'name', label: 'Problem' },
  { col: 'diff', label: 'Difficulty' },
  { col: 'acc', label: 'Acceptance' },
];

function SortArrow({ active, dir }) {
  if (!active) return null;
  return (
    <span className="sar">{dir === 'desc' ? <I.arrowDown size={12} /> : <I.arrowUp size={12} />}</span>
  );
}

/**
 * ProblemList — default catalog view: a sticky "Sort by" bar (which doubles as
 * the column headers) above full-width problem row-cards.
 *
 * Props:
 *   rows            — problems to render (current page)
 *   sortCol         — null | 'name' | 'diff' | 'acc'
 *   sortDir         — 'asc' | 'desc'
 *   onSortCol(col)  — cycle sort on a column
 *   onOpen(problem) — row click
 *   onTag(tag)      — tag chip click
 */
export default function ProblemList({ rows, sortCol, sortDir, onSortCol, onOpen, onTag }) {
  return (
    <div className="plist">
      <div className="psort">
        <span className="psort-lbl">Sort by</span>
        {COLS.map(({ col, label }) => (
          <button key={col} className={`psort-col col-${col}${sortCol === col ? ' active' : ''}`}
            onClick={() => onSortCol(col)}>
            {label}<SortArrow active={sortCol === col} dir={sortDir} />
          </button>
        ))}
      </div>

      <div className="prows">
        {rows.map((p, i) => (
          <div key={p.id} className="prow" style={{ animationDelay: `${(i % 20) * 25}ms` }}
            onClick={() => onOpen(p)}>
            <div className={`p-st ${p.status}`}><StatusIcon status={p.status} /></div>
            <span className="p-id">{p.id}</span>
            <div className="prow-main">
              <div className="p-title">{p.title}</div>
              <div className="p-tags">
                {p.tags.map((t) => (
                  <span key={t} className="tag"
                    onClick={(e) => { e.stopPropagation(); onTag(t); }}>{t}</span>
                ))}
              </div>
            </div>
            <span className={`df d-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
            <div className="p-acc">{p.acceptance.toFixed(1)}<span className="pct">%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
