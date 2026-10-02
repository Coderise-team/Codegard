import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ProblemPanel from './ProblemPanel';
import ActionBar from './ActionBar';
import LangSelect from './LangSelect';
import ReportButton from './ReportButton';
import UndoRedo from './UndoRedo';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useCodeDraft } from '../../hooks/useCodeDraft';
import { draftSlot } from '../../utils/codeDrafts';
import './ProblemWorkspace.css';

// Monaco is heavy — load it (and its chunk) only when the workspace renders.
const CodeEditor = lazy(() => import('./CodeEditor'));

/**
 * ProblemWorkspace — the mode-agnostic core of the problem page:
 * problem panel (Statement / Submissions) + splitter + code editor pane.
 * Knows no contest rules; mode-specific chrome (topbar, leaderboard rail) is
 * composed around it by the page, which also passes the round id for reports.
 *
 * The editor code is a per-language draft (useCodeDraft) read once on mount,
 * so the page remounts the workspace for every problem (key = problem id).
 *
 * Props:
 *   problem     — statement object for the left pane
 *   submissions — rows for the Submissions tab, newest first; the latest one
 *                 per language seeds the editor when there is no draft
 *   languages   — [{ id, name, template }] from GET languages/
 *   busy        — falsy | 'submit', forwarded to the ActionBar
 *   statusText  — optional ActionBar status override (defaults to
 *                 "{language} · ready")
 *   canSubmit   — gate on the Submit button (default true); false disables it
 *                 without touching Reset (e.g. a contest that has ended)
 *   onSubmit    — called with (code, languageId)
 *   rail        — optional right-side slot (contest leaderboard later)
 *   contestId   — the round the page is opened from, filed with a report and
 *                 keeping the round's drafts apart; absent in the catalog
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
  contestId,
}) {
  const [tab, setTab] = useState('statement');
  const user = useCurrentUser();
  const {
    language: langId,
    code,
    startCode,
    setLanguage,
    setCode,
    reset,
    loadSubmission,
  } = useCodeDraft(
    draftSlot(user?.username, problem.id, contestId),
    languages,
    submissions
  );
  const lang = languages.find((l) => l.id === langId);
  const [problemW, setProblemW] = useState(44);
  // The Monaco instance, once mounted — the toolbar Undo / Redo act on it.
  const [editor, setEditor] = useState(null);

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
        onPickSubmission={loadSubmission}
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
              onChange={setLanguage}
            />
          </div>
          <div className="pp-et-right">
            <UndoRedo editor={editor} />
            <ReportButton problemId={problem.id} contestId={contestId} />
          </div>
        </div>

        <Suspense
          fallback={<div className="pp-editor-loading">Loading editor…</div>}
        >
          <CodeEditor
            value={code}
            language={langId}
            startCode={startCode}
            onChange={setCode}
            onMount={setEditor}
          />
        </Suspense>

        <ActionBar
          busy={busy}
          statusText={statusText ?? `${lang.name} · ready`}
          submitDisabled={!canSubmit}
          onSubmit={() => onSubmit(code, langId)}
          onReset={reset}
        />
      </section>

      {rail}
    </div>
  );
}
