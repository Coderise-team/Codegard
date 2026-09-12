import { useEffect, useRef, useState } from 'react';

import Icons from '../Icons';

// Long enough to sit past the gap between two keystrokes (200-400ms at a normal
// pace), short enough that the answer still reads as instant once the request
// lands on top of it.
const DEBOUNCE_MS = 300;

/**
 * SearchField — the top bar input. Holds the text being typed and hands the
 * page a term only once typing stops; clearing skips the wait, since an empty
 * field is a request to see everything again.
 *
 * `value` is the term the page is showing results for. It also arrives from the
 * outside — a back step rewrites it from the address — and anything this field
 * did not send itself replaces what is in it.
 *
 * Props:
 *   placeholder — hint for this page ("Search problems…")
 *   value       — the current term
 *   onChange    — called with a new term, debounced
 */
export default function SearchField({ placeholder, value, onChange }) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  // A page passes its handler inline, so a new function arrives on every render
  // of the page; keeping it in a ref is what lets the timer below depend on the
  // term alone instead of restarting on each of those renders.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Adjust-during-render: the term moved without this field (a back step), so
  // what is typed follows it.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return undefined;
    const timer = setTimeout(() => onChangeRef.current(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value]);

  const clear = () => {
    setDraft('');
    onChangeRef.current('');
  };

  return (
    <div className="gsearch">
      <Icons.search size={15} />
      <input
        ref={inputRef}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          clear();
          inputRef.current?.blur();
        }}
      />
      {draft ? (
        <button
          className="gsearch-clear"
          title="Clear"
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
  );
}
