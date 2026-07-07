import { useState } from 'react';
import Icons from '../Icons';
import ProblemPanel from './ProblemPanel';
import ActionBar from './ActionBar';

/**
 * ProblemWorkspace — the mode-agnostic core of the problem page:
 * problem panel (Statement / Submissions) + splitter + code editor pane.
 * Knows nothing about contests; mode-specific chrome (topbar, leaderboard
 * rail) is composed around it by the page.
 *
 * Props:
 *   problem     — statement object for the left pane
 *   submissions — rows for the Submissions tab
 *   starterCode — initial editor content (Reset returns to it)
 *   busy        — falsy | 'submit', forwarded to the ActionBar
 *   statusText  — ActionBar status line
 *   onSubmit    — called with the current code
 *   rail        — optional right-side slot (contest leaderboard later)
 */
export default function ProblemWorkspace({
  problem,
  submissions,
  starterCode,
  busy,
  statusText,
  onSubmit,
  rail,
}) {
  const [tab, setTab] = useState('statement');
  const [code, setCode] = useState(starterCode);
  const [problemW, setProblemW] = useState(44);

  const onSplitMouseDown = (e) => {
    e.preventDefault();
    const onMove = (ev) => {
      const pct = (ev.clientX / window.innerWidth) * 100;
      setProblemW(Math.max(24, Math.min(66, pct)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="pp-workspace">
      <ProblemPanel
        problem={problem}
        submissions={submissions}
        tab={tab}
        onTab={setTab}
        style={{ flexBasis: `${problemW}%` }}
      />

      <div
        className="pp-vsplit"
        onMouseDown={onSplitMouseDown}
        title="Drag to resize"
      />

      <section className="pp-pane pp-editor-pane" style={{ flex: 1 }}>
        <div className="pp-editor-toolbar">
          <div className="pp-et-left">
            <button className="pp-lang-select">
              <span className="pp-lang-ic" /> Python 3
              <Icons.chevDown size={14} style={{ color: 'var(--fg2)' }} />
            </button>
          </div>
          <div className="pp-et-right">
            <button className="pp-tool-link">
              <Icons.flag size={14} /> Report
            </button>
          </div>
        </div>

        {/* STUB: plain textarea stands in until Monaco lands (plan step 6) */}
        <textarea
          className="pp-code-stub scroll"
          value={code}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setCode(e.target.value)}
        />

        <ActionBar
          busy={busy}
          statusText={statusText}
          onSubmit={() => onSubmit(code)}
          onReset={() => setCode(starterCode)}
        />
      </section>

      {rail}
    </div>
  );
}
