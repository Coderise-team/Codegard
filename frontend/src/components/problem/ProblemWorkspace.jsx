import { lazy, Suspense, useState } from 'react';
import Icons from '../Icons';
import ProblemPanel from './ProblemPanel';
import ActionBar from './ActionBar';

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
 *   onSubmit    — called with (code, languageId)
 *   rail        — optional right-side slot (contest leaderboard later)
 */
export default function ProblemWorkspace({
  problem,
  submissions,
  languages,
  busy,
  statusText,
  onSubmit,
  rail,
}) {
  const [tab, setTab] = useState('statement');
  const [langId, setLangId] = useState(languages[0].id);
  const lang = languages.find((l) => l.id === langId) ?? languages[0];
  const [code, setCode] = useState(lang.template);
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
            <label className="pp-lang-select">
              <span className="pp-lang-ic" />
              <select
                value={langId}
                onChange={(e) => setLangId(e.target.value)}
                aria-label="Language"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Icons.chevDown size={14} style={{ color: 'var(--fg2)' }} />
            </label>
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
          onSubmit={() => onSubmit(code, langId)}
          onReset={() => setCode(lang.template)}
        />
      </section>

      {rail}
    </div>
  );
}
