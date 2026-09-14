import { useEffect, useRef, useState } from 'react';

import Icons from '../Icons';

// Long enough to sit past the gap between two keystrokes (200-400ms at a normal
// pace), short enough that the answer still reads as instant once the request
// lands on top of it.
const DEBOUNCE_MS = 300;

/**
 * SearchField — the top bar input. Holds the text being typed and gives the
 * page a term only once typing stops; clearing reports it at once instead of
 * waiting, since an empty field means "show everything again".
 *
 * A page without its own list of results leaves out `onChange` and takes the
 * term on Enter instead, carrying it somewhere that can answer it.
 *
 * Props:
 *   placeholder — hint for this page ("Search problems…")
 *   value       — the term the page is showing results for
 *   onChange    — called with a new term, debounced; absent on a page that
 *                 searches nothing itself
 *   onSubmit    — called with the term on Enter
 */
export default function SearchField({
  placeholder,
  value = '',
  onChange,
  onSubmit,
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  // A page passes its handlers inline, so new functions arrive on every render
  // of the page; keeping them in a ref is what lets the timer below depend on
  // the term alone instead of restarting on each of those renders.
  const handlers = useRef({ onChange, onSubmit });
  useEffect(() => {
    handlers.current = { onChange, onSubmit };
  });

  // Adjust-during-render: the term moved without this field (a back step), so
  // what is typed follows it.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  const live = Boolean(onChange);
  useEffect(() => {
    if (!live || draft === value) return undefined;
    const timer = setTimeout(
      () => handlers.current.onChange(draft),
      DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [draft, value, live]);

  // A phone bar has no room for an open field, so CSS hides it there until this
  // flag shows it across the whole bar. On a wide screen the field is always
  // visible and the flag changes nothing.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // "/" focuses this field from anywhere on the page — the shortcut the key
  // badge shows. Skipped while another field has focus, or the slash would be
  // taken out of the text being typed there.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      // Shows the field first where CSS keeps it hidden; where it is already
      // visible, only the focus below matters.
      setOpen(true);
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const clear = () => {
    setDraft('');
    handlers.current.onChange?.('');
  };

  return (
    <>
      <button
        className="gsearch-open icon-btn"
        title="Search"
        onClick={() => setOpen(true)}
      >
        <Icons.search size={16} />
      </button>

      <div className={`gsearch${open ? ' is-open' : ''}`}>
        <Icons.search size={15} />
        <input
          ref={inputRef}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handlers.current.onSubmit?.(draft);
              return;
            }
            if (e.key === 'Escape') {
              clear();
              inputRef.current?.blur();
            }
          }}
        />
        {draft ? (
          <button
            className="gsearch-clear"
            title="Clear"
            // Keep the field focused: on a phone losing focus hides it, and it
            // would be gone before this click landed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
          >
            <Icons.x size={13} />
          </button>
        ) : (
          <span className="kbd">/</span>
        )}
      </div>
    </>
  );
}
