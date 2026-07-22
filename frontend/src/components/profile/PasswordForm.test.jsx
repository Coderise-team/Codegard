import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import PasswordForm from './PasswordForm';

const { changePassword, setTokens } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  setTokens: vi.fn(),
}));

vi.mock('../../api/auth', () => ({ changePassword }));
vi.mock('../../api/client', () => ({ tokenStorage: { set: setTokens } }));

const onClose = vi.fn();

const renderForm = () => render(<PasswordForm onClose={onClose} />);

const fill = ({ current = 'OldPass!234', next = 'BrandNew!567', confirm }) => {
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: confirm ?? next },
  });
};

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

beforeEach(() => {
  vi.clearAllMocks();
  changePassword.mockResolvedValue({ access: 'new-a', refresh: 'new-r' });
});

describe('PasswordForm', () => {
  it('stores the returned tokens so the session survives the change', async () => {
    renderForm();
    fill({});
    submit();

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        old_password: 'OldPass!234',
        new_password: 'BrandNew!567',
      })
    );
    // Changing the password revokes every refresh token, including this
    // session's — without the fresh pair the next refresh would sign the user
    // out.
    expect(setTokens).toHaveBeenCalledWith({
      access: 'new-a',
      refresh: 'new-r',
    });
    expect(
      await screen.findByText(/your password has been changed/i)
    ).toBeInTheDocument();
  });

  it('rejects a mistyped confirmation without calling the backend', () => {
    renderForm();
    fill({ confirm: 'Mistyped!567' });
    submit();

    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('shows a wrong current password under its own field', async () => {
    changePassword.mockRejectedValue({
      response: { data: { old_password: ['Current password is incorrect.'] } },
    });
    renderForm();
    fill({});
    submit();

    expect(
      await screen.findByText('Current password is incorrect.')
    ).toBeInTheDocument();
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('lists every rule a weak password broke', async () => {
    changePassword.mockRejectedValue({
      response: {
        data: {
          non_field_errors: [
            'This password is too short. It must contain at least 8 characters.',
            'This password is too common.',
          ],
        },
      },
    });
    renderForm();
    fill({ next: '12345', confirm: '12345' });
    submit();

    // Django reports all failed validators at once; showing one would make the
    // user fix them one at a time.
    expect(
      await screen.findByText(/at least 8 characters/i)
    ).toBeInTheDocument();
    expect(screen.getByText('This password is too common.')).toBeInTheDocument();
  });
});
