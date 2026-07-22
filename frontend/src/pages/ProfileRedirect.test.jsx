import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';

import ProfileRedirect from './ProfileRedirect';

const state = vi.hoisted(() => ({ user: null }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) => selector(state),
}));

const Landed = () => <div>profile of {useParams().username}</div>;

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfileRedirect />} />
        <Route path="/users/:username" element={<Landed />} />
        <Route path="/" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  state.user = { username: 'yurii' };
});

describe('ProfileRedirect', () => {
  it('hands over to the canonical profile url, which is what gets shared', () => {
    renderAt();

    expect(screen.getByText('profile of yurii')).toBeInTheDocument();
  });

  it('falls back to the dashboard when no user is loaded yet', () => {
    state.user = null;

    renderAt();

    // Never /users/undefined: that URL would answer with the 404 page.
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
});
