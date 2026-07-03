import Icons from '../Icons';

/**
 * Pagination — page info + numbered nav with ellipses.
 *
 * Props:
 *   page, pageCount, total, from, to — pagination math
 *   onPage(n)                        — jump to page n
 */
export default function Pagination({ page, pageCount, total, from, to, onPage }) {
  const I = Icons;
  if (pageCount <= 1) {
    return (
      <div className="ps-pager">
        <div className="pg-info">Showing <b>{total}</b> {total === 1 ? 'problem' : 'problems'}</div>
      </div>
    );
  }
  const set = new Set([1, pageCount, page, page - 1, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const items = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) items.push('e' + n);
    items.push(n); prev = n;
  }
  return (
    <div className="ps-pager">
      <div className="pg-info">Showing <b>{from}–{to}</b> of <b>{total}</b></div>
      <div className="pg-nav">
        <button className="pg-btn" disabled={page === 1} onClick={() => onPage(page - 1)}
          aria-label="Previous"><I.chevRight size={15} style={{ transform: 'rotate(180deg)' }} /></button>
        {items.map((it) => typeof it === 'string'
          ? <span key={it} className="pg-ellip">…</span>
          : <button key={it} className={`pg-btn${it === page ? ' on' : ''}`}
              onClick={() => onPage(it)}>{it}</button>)}
        <button className="pg-btn" disabled={page === pageCount} onClick={() => onPage(page + 1)}
          aria-label="Next"><I.chevRight size={15} /></button>
      </div>
    </div>
  );
}
