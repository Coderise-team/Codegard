import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ProfileForm from './ProfileForm';

const { updateProfile, setUser } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock('../../api/auth', () => ({ updateProfile }));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector) =>
    selector({
      user: {
        username: 'yurii',
        first_name: 'Old',
        last_name: 'Name',
        bio: 'old bio',
      },
      setUser,
    }),
}));

const onSaved = vi.fn();
const onClose = vi.fn();

const renderForm = () =>
  render(<ProfileForm onSaved={onSaved} onClose={onClose} />);

beforeEach(() => {
  vi.clearAllMocks();
  updateProfile.mockResolvedValue({
    first_name: 'Yurii',
    last_name: '',
    bio: 'new bio',
  });
});

describe('ProfileForm', () => {
  it('prefills the fields from the stored user', () => {
    renderForm();

    expect(screen.getByLabelText('First name')).toHaveValue('Old');
    expect(screen.getByLabelText('Last name')).toHaveValue('Name');
    expect(screen.getByLabelText(/^Bio/)).toHaveValue('old bio');
  });

  it('caps the bio at the length the backend accepts', () => {
    renderForm();

    expect(screen.getByLabelText(/^Bio/)).toHaveAttribute('maxLength', '300');
    expect(screen.getByText('7/300')).toBeInTheDocument();
  });

  it('saves the edited fields, then reloads the profile and closes', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Yurii' },
    });
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/^Bio/), {
      target: { value: 'new bio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        first_name: 'Yurii',
        last_name: '',
        bio: 'new bio',
      })
    );
    // The store keeps the form correct on reopen, the reload refreshes the
    // header behind the dialog.
    expect(setUser).toHaveBeenCalledWith({
      first_name: 'Yurii',
      last_name: '',
      bio: 'new bio',
    });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a field error from the backend and stays open', async () => {
    updateProfile.mockRejectedValue({
      response: {
        data: { bio: ['Ensure this field has no more than 300 characters.'] },
      },
    });
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Ensure this field has no more than 300 characters.'
      )
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('reports a failure that carries no field errors', async () => {
    updateProfile.mockRejectedValue(new Error('Network Error'));
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(/could not save your profile/i)
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
