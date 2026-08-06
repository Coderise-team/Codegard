import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import PrivacyPage from './PrivacyPage';

const renderPage = () => {
  const router = createMemoryRouter(
    [{ path: '/privacy', element: <PrivacyPage /> }],
    { initialEntries: ['/privacy'] }
  );
  return render(<RouterProvider router={router} />);
};

describe('PrivacyPage', () => {
  it('renders the policy with its key required sections', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })
    ).toBeInTheDocument();
    // The Google user data / Limited Use disclosure is the section Google's
    // verification specifically looks for.
    expect(
      screen.getByRole('heading', { name: /Google user data and Limited Use/i })
    ).toBeInTheDocument();
    // The contact email appears in several sections; at least one is enough.
    expect(
      screen.getAllByText(/codegard.team@gmail.com/i).length
    ).toBeGreaterThan(0);
  });

  it('links the brand back to the home page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Codegard' })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
