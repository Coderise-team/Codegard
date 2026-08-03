import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Icons from '../Icons';
import ProblemPanel from './ProblemPanel';
import ActionBar from './ActionBar';
import LangSelect from './LangSelect';
import './ProblemWorkspace.css';

// Monaco is heavy — load it (and its chunk) only when the workspace renders.
const CodeEditor = lazy(() => import('./CodeEditor'));

/**
 * ProblemWorkspace — the mode-agnostic core of the problem page:
 * problem panel (Statement / Submissions) + splitter + code editor pane.
 * Knows nothing about contests; mode-specific chrome (topbar, leaderboard
 * rail) is composed around it by the page.
 *
 * Props:
 *   problem     — statement object for the left pane
 *   submissions — rows for the Submissions tab
 *   languages   — [{ id, name, template }] from GET languages/
 *   busy        — falsy | 'submit', forwarded to the ActionBar
 *   statusText  — optional ActionBar status override (defaults to
 *                 "{language} · ready")
 *   canSubmit   — gate on the Submit button (default true); false disables it
 *                 without touching Reset (e.g. a contest that has ended)
 *   onSubmit    — called with (code, languageId)
 *   rail        — optional right-side slot (contest leaderboard later)
 */
export default function ProblemWorkspace({
  problem,
  submissions,
  languages,
  busy,
  statusText,
  canSubmit = true,
  onSubmit,
  rail,
}) {
  const [tab, setTab] = useState('statement');
  const [langId, setLangId] = useState(languages[0].id);
  const lang = languages.find((l) => l.id === langId) ?? languages[0];
  const [code, setCode] = useState(lang.template);
  const [problemW, setProblemW] = useState(44);

  // The active drag's listener cleanup — also runs on unmount, so a drag
  // interrupted by navigation doesn't leave window listeners behind.
  const dragCleanup = useRef(null);
  useEffect(() => () => dragCleanup.current?.(), []);

  const onSplitMouseDown = (e) => {
    e.preventDefault();
    const onMove = (ev) => {
      const pct = (ev.clientX / window.innerWidth) * 100;
      setProblemW(Math.max(24, Math.min(66, pct)));
    };
    const onUp = () => dragCleanup.current?.();
    dragCleanup.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dragCleanup.current = null;
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
            <LangSelect
              languages={languages}
              value={langId}
              onChange={setLangId}
            />
          </div>
          <div className="pp-et-right">
            <button className="pp-tool-link">
              <Icons.flag size={14} /> Report
            </button>
          </div>
        </div>

        <Suspense
          fallback={<div className="pp-editor-loading">Loading editor…</div>}
        >
          <CodeEditor value={code} language={langId} onChange={setCode} />
        </Suspense>

        <ActionBar
          busy={busy}
          statusText={statusText ?? `${lang.name} · ready`}
          submitDisabled={!canSubmit}
          onSubmit={() => onSubmit(code, langId)}
          onReset={() => setCode(lang.template)}
        />
      </section>

      {rail}
    </div>
  );
}
