import Icons from '../Icons';
import { StatusIcon } from './bits';

const I = Icons;

function SortArrow({ active, dir }) {
  if (!active) return null;
  return (
    <span className="sar">{dir === 'desc' ? <I.arrowDown size={12} /> : <I.arrowUp size={12} />}</span>
  );
}

function SortTh({ col, label, className, sortCol, sortDir, onSortCol }) {
  const active = sortCol === col;
  return (
    <th className={`sortable${className ? ' ' + className : ''}${active ? ' active' : ''}`}
      onClick={() => onSortCol(col)}>
      {label}<SortArrow active={active} dir={sortDir} />
    </th>
  );
}

/**
 * ProblemTable — table view with header-click sorting.
 *
 * Props:
 *   rows                 — problems to render (current page)
 *   sortCol              — null | 'id' | 'diff' | 'acc'
 *   sortDir              — 'desc' | 'asc'
 *   onSortCol(col)       — cycle sort on a column
 *   onOpen(problem)      — row click
 *   onTag(tag)           — tag chip click
 */
export default function ProblemTable({ rows, sortCol, sortDir, onSortCol, onOpen, onTag }) {
  const sortProps = { sortCol, sortDir, onSortCol };
  return (
    <div className="ptable-wrap">
      <table className="ptable">
        <thead>
          <tr>
            <th className="col-st"></th>
            <SortTh col="id" label="#" className="col-id" {...sortProps} />
            <th>Problem</th>
            <SortTh col="diff" label="Difficulty" className="col-diff" {...sortProps} />
            <SortTh col="acc" label="Acceptance" className="col-acc" {...sortProps} />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} onClick={() => onOpen(p)}>
              <td className="col-st">
                <div className={`p-st ${p.status}`}><StatusIcon status={p.status} /></div>
              </td>
              <td><span className="p-id">{p.id}</span></td>
              <td>
                <div className="p-title">{p.title}</div>
                <div className="p-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="tag"
                      onClick={(e) => { e.stopPropagation(); onTag(t); }}>{t}</span>
                  ))}
                </div>
              </td>
              <td><span className={`df d-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span></td>
              <td><div className="p-acc">{p.acceptance.toFixed(1)}<span className="pct">%</span></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
