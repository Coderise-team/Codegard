import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SettingsModal from './SettingsModal';

// The two tabs' bodies are exercised on their own, and so is the dialog frame
// (Modal.test.jsx); here we only steer the tabs.
vi.mock('./ProfileForm', () => ({ default: () => <div>profile form</div> }));
vi.mock('./PasswordForm', () => ({ default: () => <div>password form</div> }));

describe('SettingsModal', () => {
  it('opens on the Profile tab and switches to Password', () => {
    render(<SettingsModal onClose={() => {}} onSaved={() => {}} />);

    expect(screen.getByText('profile form')).toBeInTheDocument();
    expect(screen.queryByText('password form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Password' }));

    expect(screen.getByText('password form')).toBeInTheDocument();
    expect(screen.queryByText('profile form')).not.toBeInTheDocument();
  });
});
