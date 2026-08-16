import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import LandingPage from './LandingPage';
import landingContent from '../utils/landingContent';

// The page runs a typing editor, a board that re-sorts itself and a scrubbed
// section; none of that is what these tests are about.
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

// The page's links into the product are router links, so it needs a router
// around it the same way the app gives it one.
const renderPage = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );

const hrefsIn = (container, selector) =>
  Array.from(container.querySelectorAll(`${selector} a`))
    .map((link) => link.getAttribute('href'))
    .filter((href) => href.startsWith('#'));

describe('LandingPage', () => {
  it('has a section behind every name in the bar', () => {
    const { container } = renderPage();
    const links = hrefsIn(container, '.nav-links');

    expect(links.length).toBeGreaterThan(0);
    links.forEach((href) => {
      expect(container.querySelector(href)).not.toBeNull();
    });
  });

  it('lists the same sections in the footer as in the bar', () => {
    const { container } = renderPage();

    expect(hrefsIn(container, '.foot-col')).toEqual(
      hrefsIn(container, '.nav-links')
    );
  });

  it('sends both of its calls to action to the sign-up form', () => {
    renderPage();

    expect(
      screen.getByRole('link', { name: /start solving/i })
    ).toHaveAttribute('href', '/register');
    expect(
      screen.getAllByRole('link', { name: /create account/i })[0]
    ).toHaveAttribute('href', '/register');
  });

  it('answers every question it promises to answer', () => {
    renderPage();

    landingContent.faq.forEach(({ q }) => {
      expect(screen.getByRole('button', { name: q })).toBeInTheDocument();
    });
  });

  it('keeps the interface mocks out of a page translator', () => {
    const { container } = renderPage();

    [
      '.ed-shell',
      '.contest-stack',
      '.how-vis',
      '.solo-cat',
      '.rank-panel',
    ].forEach((selector) => {
      expect(container.querySelector(selector)).toHaveAttribute(
        'translate',
        'no'
      );
    });
  });
});
