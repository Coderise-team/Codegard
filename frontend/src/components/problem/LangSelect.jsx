import { useEffect, useRef, useState } from 'react';
import Icons from '../Icons';

/**
 * LangSelect — language picker for the editor toolbar.
 *
 * A custom dropdown rather than a native <select>, so the menu follows the
 * platform styles instead of the OS default (the blue/white system list).
 * Works whether there is one language or many.
 *
 * Props:
 *   languages — [{ id, name }]
 *   value     — selected language id
 *   onChange  — called with the picked id
 */
export default function LangSelect({ languages, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = languages.find((l) => l.id === value) ?? languages[0];

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="pp-lang" ref={ref}>
      <button
        type="button"
        className="pp-lang-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="pp-lang-ic" />
        <span className="pp-lang-name">{current.name}</span>
        <Icons.chevDown size={14} />
      </button>

      {open && (
        <ul className="pp-lang-pop" role="listbox">
          {languages.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={l.id === value}
                className={`pp-lang-opt${l.id === value ? ' is-sel' : ''}`}
                onClick={() => pick(l.id)}
              >
                <span className="pp-lang-ic" />
                <span className="pp-lang-name">{l.name}</span>
                {l.id === value && <Icons.checkBold size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
