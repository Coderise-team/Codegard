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
};

/**
 * CodeEditor — Monaco wrapper for the workspace editor pane.
 *
 * Props:
 *   value    — current code
 *   language — Monaco language id (matches the backend language id)
 *   onChange — called with the new code
 */
export default function CodeEditor({ value, language, onChange }) {
  return (
    <div className="pp-editor-host">
      <Editor
        value={value}
        language={language}
        theme={THEME}
        options={OPTIONS}
        onChange={(v) => onChange(v ?? '')}
      />
    </div>
  );
}
