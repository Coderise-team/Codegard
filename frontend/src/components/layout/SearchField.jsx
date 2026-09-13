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
 * A page without its own list of results leaves out `onChange` and takes the
 * term on Enter instead: nothing is searched here, the typing is carried
 * somewhere that can answer it.
 *
 * Props:
 *   placeholder — hint for this page ("Search problems…")
 *   value       — the current term
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

  const clear = () => {
    setDraft('');
    handlers.current.onChange?.('');
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
          if (e.key === 'Enter') handlers.current.onSubmit?.(draft);
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
