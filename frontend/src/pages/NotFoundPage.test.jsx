import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import NotFoundPage from './NotFoundPage';

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) => selector({ user: { username: 'ada' } }),
}));

const renderPage = (props) => {
  const router = createMemoryRouter(
    [{ path: '/nope', element: <NotFoundPage {...props} /> }],
    { initialEntries: ['/nope'] }
  );
  return render(<RouterProvider router={router} />);
};

describe('NotFoundPage', () => {
  it('shows the default 404 copy and a way back to the dashboard', () => {
    renderPage();

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to dashboard' })
    ).toHaveAttribute('href', '/');
  });

  it('takes over the copy when a page reuses it for a missing resource', () => {
    renderPage({ title: 'Problem not found', sub: 'No such problem.' });

    expect(screen.getByText('Problem not found')).toBeInTheDocument();
    expect(screen.getByText('No such problem.')).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });
});
