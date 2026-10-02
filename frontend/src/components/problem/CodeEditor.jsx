import { useLayoutEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import Editor, { loader } from '@monaco-editor/react';

// Self-hosted Monaco: serve the bundled package instead of the loader's CDN
// default (works offline / under a strict CSP). Python needs no language
// worker — tokenization runs on the main thread, one editor worker is enough.
self.MonacoEnvironment = { getWorker: () => new editorWorker() };
loader.config({ monaco });

// Editor surface matches the workspace tokens (variables.css); syntax colors
// follow the One Dark palette the mock used.
const THEME = 'codegard-dark';
monaco.editor.defineTheme(THEME, {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c678dd' },
    { token: 'string', foreground: '98c379' },
    { token: 'number', foreground: 'd19a66' },
    { token: 'type', foreground: '56b6c2' },
    { token: 'identifier', foreground: 'abb2bf' },
  ],
  colors: {
    'editor.background': '#0f121a',
    'editor.foreground': '#abb2bf',
    'editor.lineHighlightBackground': '#13161f',
    'editor.selectionBackground': '#a78bfa3d',
    'editorCursor.foreground': '#c4b5fd',
    'editorLineNumber.foreground': '#444b5c',
    'editorLineNumber.activeForeground': '#a78bfa',
    'editorGutter.background': '#0f121a',
    'editorWidget.background': '#13161f',
    'editorWidget.border': '#1e2232',
  },
});

const OPTIONS = {
  fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  fontSize: 13,
  lineHeight: 21,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  tabSize: 4,
  insertSpaces: true,
  automaticLayout: true,
  padding: { top: 14, bottom: 14 },
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  // No minimap, so drop the overview-ruler lane and its border too — otherwise
  // it leaves a thin marker strip down the editor's right edge.
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
};

/**
 * CodeEditor — Monaco wrapper for the workspace editor pane.
 *
 * Each language of each `historyKey` gets its own Monaco model, so each keeps
 * its own undo history: undo never brings another language's code back, and
 * coming back to a problem brings its history back too, until the page
 * reloads. A model is created on its first visit, holding `startCode`; code
 * then put in from outside (a loaded submission, Reset) is an ordinary edit,
 * which undo can take back.
 *
 * A kept model can fall behind `value` (the draft changed in another tab, or
 * could not be saved); it is then brought up to `value` with an ordinary edit
 * when it comes on screen, so what is shown is always what gets submitted.
 *
 * Props:
 *   value      — current code
 *   language   — Monaco language id (matches the backend language id)
 *   historyKey — whose models these are (one problem in one place); the same
 *                key on a later mount picks the same models back up
 *   startCode  — the code the language started with; seeds its model
 *   onChange   — called with the new code
 *   onMount    — called with the Monaco editor instance once it is ready
 */
export default function CodeEditor({
  value,
  language,
  historyKey,
  startCode,
  onChange,
  onMount,
}) {
  // The latest code and change handler. Set in a layout effect, so both are
  // fresh before the wrapper switches models in its effects: its change
  // listener still belongs to the previous render then, and calling an older
  // `onChange` would file the code under the language being left.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const catchUp = (editor) => {
    const model = editor.getModel();
    const code = valueRef.current;
    if (!model || model.getValue() === code) return;
    editor.executeEdits('', [
      { range: model.getFullModelRange(), text: code, forceMoveMarkers: true },
    ]);
    editor.pushUndoStop();
  };

  const handleMount = (editor) => {
    catchUp(editor);
    editor.onDidChangeModel(() => catchUp(editor));
    onMount(editor);
  };

  return (
    <div className="pp-editor-host">
      <Editor
        path={`${encodeURIComponent(historyKey)}/${language}`}
        keepCurrentModel
        defaultValue={startCode}
        value={value}
        language={language}
        theme={THEME}
        options={OPTIONS}
        onChange={(v) => onChangeRef.current(v ?? '')}
        onMount={handleMount}
      />
    </div>
  );
}
