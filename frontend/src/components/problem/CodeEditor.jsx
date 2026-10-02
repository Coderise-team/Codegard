import { useEffect, useState } from 'react';
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

// Numbers each mounted editor, so its models never clash with another's.
let editorSeq = 0;

/**
 * CodeEditor — Monaco wrapper for the workspace editor pane.
 *
 * Each language gets its own Monaco model, so each keeps its own undo
 * history: undo never brings another language's code back. A model is created
 * on the language's first visit, holding `startCode`; code then put in from
 * outside (a loaded submission, Reset) is an ordinary edit, which undo can
 * take back. The models live as long as the editor does.
 *
 * Props:
 *   value     — current code
 *   language  — Monaco language id (matches the backend language id)
 *   startCode — the code the language started with; seeds its model
 *   onChange  — called with the new code
 */
export default function CodeEditor({ value, language, startCode, onChange }) {
  const [prefix] = useState(() => `editor-${++editorSeq}/`);

  // The wrapper disposes only the model on screen when it unmounts; the
  // other languages' models are left for this editor to drop.
  useEffect(
    () => () => {
      const own = monaco.Uri.parse(prefix).toString();
      monaco.editor
        .getModels()
        .filter((m) => m.uri.toString().startsWith(own))
        .filter((m) => !m.isAttachedToEditor())
        .forEach((m) => m.dispose());
    },
    [prefix]
  );

  return (
    <div className="pp-editor-host">
      <Editor
        path={`${prefix}${language}`}
        defaultValue={startCode}
        value={value}
        language={language}
        theme={THEME}
        options={OPTIONS}
        onChange={(v) => onChange(v ?? '')}
      />
    </div>
  );
}
