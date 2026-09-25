import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import TermsPage from './TermsPage';

const renderPage = () => {
  const router = createMemoryRouter(
    [{ path: '/terms', element: <TermsPage /> }],
    { initialEntries: ['/terms'] }
  );
  return render(<RouterProvider router={router} />);
};

describe('TermsPage', () => {
  // Structure, never wording: the copy will keep changing, and a test tied to a
  // sentence dies on the first edit while proving nothing.
  it('renders the terms with the sections the page exists for', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms of Service' })
    ).toBeInTheDocument();

    // The four the page was asked for: fair play, the limits on what may be
    // done to the platform, the absence of an uptime promise, and the right to
    // close an account. Losing any of them leaves nothing to point at the day
    // someone has to be blocked.
    for (const section of [
      'Fair play',
      'What you must not do',
      'Availability of the service',
      'Suspension and closing an account',
    ]) {
      expect(
        screen.getByRole('heading', { name: section })
      ).toBeInTheDocument();
    }
  });

  it('gives a working contact address', () => {
    renderPage();

    // The address appears in several sections; every one of them has to be a
    // mailto link, not plain text a reader would have to copy out by hand.
    const links = screen.getAllByRole('link', {
      name: /codegard\.team@gmail\.com/i,
    });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', 'mailto:codegard.team@gmail.com');
    }
  });

  it('sets a descriptive document title', () => {
    renderPage();

    expect(document.title).toBe('Terms of Service — Codegard');
  });

  it('puts the previous title back when the reader leaves the page', () => {
    document.title = 'Codegard';

    const { unmount } = renderPage();
    expect(document.title).toBe('Terms of Service — Codegard');

    unmount();

    // Without the restore, the tab would go on advertising the terms across
    // every page the reader opens next.
    expect(document.title).toBe('Codegard');
  });

  it('offers a table of contents that jumps to sections', () => {
    renderPage();

    const toc = screen.getByRole('navigation', { name: /table of contents/i });
    expect(
      within(toc).getByRole('link', { name: 'Fair play' })
    ).toHaveAttribute('href', '#fair-play');
  });

  it('sends the reader on to the privacy policy', () => {
    renderPage();

    // The two documents split the subject between them — these terms cover the
    // service, the policy covers the data — so one has to reach the other.
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' })
    ).toHaveAttribute('href', '/privacy');
  });

  it('links the brand logo back to the home page', () => {
    renderPage();

    // Exact name, not a substring: the table of contents carries a "Who can
    // use Codegard" link, and a loose match would find both.
    expect(screen.getByRole('link', { name: 'Codegard' })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
