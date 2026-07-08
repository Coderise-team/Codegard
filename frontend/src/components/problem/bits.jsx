import { useState } from 'react';
import Icons from '../Icons';

/**
 * CopyBtn — copies `text` to the clipboard, flashes a check for a moment.
 */
export function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1100);
  };
  return (
    <button className="pp-copy-btn" onClick={copy}>
      {done ? <Icons.check size={14} /> : <Icons.copy size={14} />}
    </button>
  );
}

/**
 * Example — one visible test case rendered as a sample: input/expected
 * output pair plus an optional note.
 */
export function Example({ example, index }) {
  return (
    <div className="pp-example">
      <div className="pp-example-hd">
        <span>Example {index + 1}</span>
      </div>
      <div className="pp-example-grid">
        <div className="pp-io-cell">
          <div className="pp-io-lbl">
            <span>Input</span>
            <CopyBtn text={example.input} />
          </div>
          <pre>{example.input}</pre>
        </div>
        <div className="pp-io-cell">
          <div className="pp-io-lbl">
            <span>Output</span>
            <CopyBtn text={example.expected_output} />
          </div>
          <pre>{example.expected_output}</pre>
        </div>
      </div>
      {example.note && <div className="pp-example-note">{example.note}</div>}
    </div>
  );
}
