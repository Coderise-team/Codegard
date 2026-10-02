import { useSyncExternalStore } from 'react';
import Icons from '../Icons';

const NONE = 'none';

// Snapshot of the history buttons as a plain string, so React can compare it.
const snapshot = (editor) => {
  const model = editor?.getModel();
  if (!model) return NONE;
  return `${model.canUndo()}/${model.canRedo()}`;
};

/**
 * UndoRedo — Undo / Redo buttons for the editor toolbar, for those who don't
 * know Ctrl+Z / Ctrl+Shift+Z. They act on the language on screen, and each
 * goes inactive when that history has nothing left to step through.
 *
 * Props:
 *   editor — the Monaco editor instance, or null until it has mounted
 */
export default function UndoRedo({ editor }) {
  const state = useSyncExternalStore(
    (notify) => {
      if (!editor) return () => {};
      const subs = [
        editor.onDidChangeModelContent(notify),
        editor.onDidChangeModel(notify),
      ];
      return () => subs.forEach((s) => s.dispose());
    },
    () => snapshot(editor)
  );
  const [canUndo, canRedo] = state.split('/').map((v) => v === 'true');

  const run = (command) => {
    editor.trigger('toolbar', command, null);
    editor.focus();
  };

  return (
    <>
      <button
        type="button"
        className="pp-tool-link"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={() => run('undo')}
      >
        <Icons.undo size={14} />
      </button>
      <button
        type="button"
        className="pp-tool-link"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={() => run('redo')}
      >
        <Icons.redo size={14} />
      </button>
    </>
  );
}
