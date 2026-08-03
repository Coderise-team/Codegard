import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SettingsModal from './SettingsModal';

// The two tabs' bodies are exercised on their own; here we only steer the shell.
vi.mock('./ProfileForm', () => ({ default: () => <div>profile form</div> }));
vi.mock('./PasswordForm', () => ({ default: () => <div>password form</div> }));

const renderModal = (props) =>
  render(<SettingsModal onClose={() => {}} onSaved={() => {}} {...props} />);

describe('SettingsModal', () => {
  it('opens on the Profile tab and switches to Password', () => {
    renderModal();

    expect(screen.getByText('profile form')).toBeInTheDocument();
    expect(screen.queryByText('password form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Password' }));

    expect(screen.getByText('password form')).toBeInTheDocument();
    expect(screen.queryByText('profile form')).not.toBeInTheDocument();
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
    fireEvent.mouseDown(document.querySelector('.sm-panel'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.querySelector('.sm-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the close button', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: /close settings/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
