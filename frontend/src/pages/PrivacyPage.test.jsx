import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  it('links the brand logo back to the home page', () => {
    renderPage();

    // The header uses the shared Codegard logo (C / Code / gard spans), so match
    // the only link that points home rather than a specific text label.
    const home = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/');
    expect(home).toBeDefined();
  });

  it('sets a descriptive document title', () => {
    renderPage();

    expect(document.title).toBe('Privacy Policy — Codegard');
  });

  it('offers a table of contents that jumps to sections', () => {
    renderPage();

    const toc = screen.getByRole('navigation', { name: /table of contents/i });
    expect(
      within(toc).getByRole('link', {
        name: 'Google user data and Limited Use',
      })
    ).toHaveAttribute('href', '#google-user-data');
  });

  it('links out to the third-party providers privacy policies', () => {
    renderPage();

    expect(
      screen.getByRole('link', { name: /Google Privacy Policy/i })
    ).toHaveAttribute('href', 'https://policies.google.com/privacy');
    expect(
      screen.getByRole('link', { name: /Cloudflare Privacy Policy/i })
    ).toHaveAttribute('href', 'https://www.cloudflare.com/privacypolicy/');
  });
});
