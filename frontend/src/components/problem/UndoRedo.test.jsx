import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import UndoRedo from './UndoRedo';

// A stand-in for the Monaco editor: just the calls the buttons make, with the
// history flags of the model on screen and its two change events.
function fakeEditor({ canUndo = false, canRedo = false } = {}) {
  const listeners = { content: new Set(), model: new Set() };
  const on = (kind) => (fn) => {
    listeners[kind].add(fn);
    return { dispose: () => listeners[kind].delete(fn) };
  };
  const editor = {
    history: { canUndo, canRedo },
    getModel: () => ({
      canUndo: () => editor.history.canUndo,
      canRedo: () => editor.history.canRedo,
    }),
    onDidChangeModelContent: on('content'),
    onDidChangeModel: on('model'),
    trigger: vi.fn(),
    focus: vi.fn(),
    // Changes the history and fires one of the editor events.
    emit(kind, history) {
      editor.history = history;
      listeners[kind].forEach((fn) => fn());
    },
  };
  return editor;
}

const undo = () => screen.getByRole('button', { name: 'Undo' });
const redo = () => screen.getByRole('button', { name: 'Redo' });

describe('UndoRedo', () => {
  it('stays inactive until the editor has mounted', () => {
    render(<UndoRedo editor={null} />);

    expect(undo()).toBeDisabled();
    expect(redo()).toBeDisabled();
  });

  it('is active only where the history has a step to take', () => {
    render(<UndoRedo editor={fakeEditor({ canUndo: true })} />);

    expect(undo()).toBeEnabled();
    expect(redo()).toBeDisabled();
  });

  it.each([
    ['an edit', 'content'],
    ['a language switch', 'model'],
  ])('follows the history after %s', (_, kind) => {
    const editor = fakeEditor();
    render(<UndoRedo editor={editor} />);

    act(() => editor.emit(kind, { canUndo: true, canRedo: true }));

    expect(undo()).toBeEnabled();
    expect(redo()).toBeEnabled();
  });

  it.each([
    ['Undo', 'undo'],
    ['Redo', 'redo'],
  ])('%s runs the editor command and hands focus back', (name, command) => {
    const editor = fakeEditor({ canUndo: true, canRedo: true });
    render(<UndoRedo editor={editor} />);

    fireEvent.click(screen.getByRole('button', { name }));

    expect(editor.trigger).toHaveBeenCalledWith('toolbar', command, null);
    expect(editor.focus).toHaveBeenCalled();
  });
});
