import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import LandingPage from './LandingPage';
import landingContent from '../utils/landingContent';

// The page runs a typing editor, a board that re-sorts itself and a scrubbed
// section; none of that is what these tests are about.
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

const hrefsIn = (container, selector) =>
  Array.from(container.querySelectorAll(`${selector} a`))
    .map((link) => link.getAttribute('href'))
    .filter((href) => href.startsWith('#'));

describe('LandingPage', () => {
  it('has a section behind every name in the bar', () => {
    const { container } = render(<LandingPage />);
    const links = hrefsIn(container, '.nav-links');

    expect(links.length).toBeGreaterThan(0);
    links.forEach((href) => {
      expect(container.querySelector(href)).not.toBeNull();
    });
  });

  it('lists the same sections in the footer as in the bar', () => {
    const { container } = render(<LandingPage />);

    expect(hrefsIn(container, '.foot-col')).toEqual(
      hrefsIn(container, '.nav-links')
    );
  });

  it('sends both of its calls to action to the sign-up form', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('link', { name: /start solving/i })
    ).toHaveAttribute('href', '/register');
    expect(
      screen.getAllByRole('link', { name: /create account/i })[0]
    ).toHaveAttribute('href', '/register');
  });

  it('answers every question it promises to answer', () => {
    render(<LandingPage />);

    landingContent.faq.forEach(({ q }) => {
      expect(screen.getByRole('button', { name: q })).toBeInTheDocument();
    });
  });

  it('keeps the interface mocks out of a page translator', () => {
    const { container } = render(<LandingPage />);

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
