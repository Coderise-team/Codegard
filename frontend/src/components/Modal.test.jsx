import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Modal from './Modal';

const renderModal = (props) =>
  render(
    <Modal title="Settings" onClose={() => {}} {...props}>
      <input aria-label="First" />
      <input aria-label="Last" />
    </Modal>
  );

describe('Modal', () => {
  it('names the dialog after its title', () => {
    renderModal();

    expect(
      screen.getByRole('dialog', { name: 'Settings' })
    ).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop press but not on one inside the panel', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // A press that starts inside the dialog must not dismiss it — otherwise
    // releasing a text selection outside would read as a backdrop click.
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.querySelector('.modal-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the close button', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the panel in both directions', () => {
    renderModal();
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByLabelText('Last');

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('holds the page scroll and focus while open and gives both back', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderModal();
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');

    opener.remove();
  });
});
