import { useState, useRef, useEffect } from 'react';
import Icons from '../Icons';

/* ---------------------------- Tag dropdown ---------------------------- */
function TagDropdown({ tags, counts, active, onToggle }) {
  const I = Icons;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const shown = tags.filter((t) => counts[t]).sort((a, b) => counts[b] - counts[a]);
  return (
    <div className="ps-tagdd" ref={ref}>
      <button className={`ps-tagdd-btn${open || active.length ? ' on' : ''}`} onClick={() => setOpen((o) => !o)}>
        <I.grid size={15} /> Tags
        {active.length > 0 && <span className="cnt">{active.length}</span>}
        <I.chevDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }} />
      </button>
      {open && (
        <div className="ps-tagdd-menu scroll">
          {shown.map((t) => {
            const on = active.includes(t);
            return (
              <button key={t} className={`tagdd-item${on ? ' on' : ''}`} onClick={() => onToggle(t)}>
                <span className="box">{on && <I.check size={12} />}</span>
                <span className="nm">{t}</span>
                <span className="cnt">{counts[t]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Filter toolbar ---------------------------- */
/**
 * Toolbar — difficulty + status segmented filters, tag dropdown, and the
 * table/cards view toggle.
 *
 * Props:
 *   diff, onDiff       — difficulty filter ('all' | 'Easy' | 'Medium' | 'Hard')
 *   status, onStatus   — status filter ('all' | 'todo' | 'attempted' | 'solved')
 *   view, onView       — list view ('list' | 'grid')
 *   tags, counts       — tag universe + per-tag counts
 *   tagsSel, onToggleTag — selected tags + toggle
 */
export default function Toolbar({ diff, onDiff, status, onStatus, view, onView, tags, counts, tagsSel, onToggleTag }) {
  const I = Icons;
  const diffs = [['all', 'All'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']];
  const stats = [['all', 'All'], ['todo', 'Todo'], ['attempted', 'Attempted'], ['solved', 'Solved']];
  return (
    <div className="ps-toolbar">
      <div className="ps-seg" role="radiogroup" aria-label="Difficulty">
        {diffs.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={diff === v}
            className={`${diff === v ? 'on' : ''} ${v !== 'all' ? 'd-' + v.toLowerCase() : ''}`}
            onClick={() => onDiff(v)}>
            {v !== 'all' && <span className="sdot"></span>}{l}
          </button>
        ))}
      </div>

      <div className="ps-seg" role="radiogroup" aria-label="Status">
        {stats.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={status === v}
            className={status === v ? 'on' : ''} onClick={() => onStatus(v)}>{l}</button>
        ))}
      </div>

      <TagDropdown tags={tags} counts={counts} active={tagsSel} onToggle={onToggleTag} />

      <div className="spacer"></div>

      <div className="ps-vtoggle" role="radiogroup" aria-label="View">
        <button role="radio" aria-checked={view === 'list'} className={view === 'list' ? 'on' : ''}
          onClick={() => onView('list')} title="List view"><I.list size={16} /></button>
        <button role="radio" aria-checked={view === 'grid'} className={view === 'grid' ? 'on' : ''}
          onClick={() => onView('grid')} title="Grid view"><I.grid size={16} /></button>
      </div>
    </div>
  );
}

/* ---------------------------- Selected-tag chips ---------------------------- */
export function SelectedTags({ tagsSel, onToggle, onClear }) {
  const I = Icons;
  if (!tagsSel.length) return null;
  return (
    <div className="ps-seltags">
      <span className="lbl">Tags</span>
      {tagsSel.map((t) => (
        <button key={t} className="seltag" onClick={() => onToggle(t)}>
          {t}<I.x size={12} />
        </button>
      ))}
      <button className="seltag-clear" onClick={onClear}>Clear all</button>
    </div>
  );
}
