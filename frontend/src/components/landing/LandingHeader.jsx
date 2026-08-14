import { useState, useEffect } from 'react';
import Icons from '../Icons';
import EditorMock from './EditorMock';
import { useLandingScroll } from '../../hooks/useLandingScroll';

/**
 * Brand lockup. On the landing it points at the top of the page rather than at
 * the site root: the root belongs to the product, and sending someone back to
 * the page they are already reading would cost a full reload.
 */
export function LandingLogo({ href = '#top' }) {
  return (
    <a href={href} className="logo" style={{ color: 'inherit' }}>
      <span className="mark">C</span>
      <span>
        <span className="wm-a">Code</span>
        <span className="wm-b">gard</span>
      </span>
    </a>
  );
}

const NAV_SECTIONS = [
  ['#top', 'Home'],
  ['#contests', 'Contests'],
  ['#how', 'How it works'],
  ['#solo', 'Solo'],
  ['#rating', 'Rating'],
  ['#judge', 'Under the hood'],
  ['#faq', 'FAQ'],
];

/**
 * Sticky marketing header — gains a border once the page scrolls.
 *
 * Seven sections fit a desktop bar and nothing narrower: on a tablet the names
 * are squeezed until they clip, and the account button is pushed off the edge.
 * Below that width the list moves into a menu behind a button, which is opened
 * and closed here; which of the two is shown is left to the stylesheet, so the
 * two versions cannot disagree about where the line between them falls.
 */
export function LandingNav() {
  const scrollEl = useLandingScroll();
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!scrollEl) return undefined;
    const on = () => setStuck(scrollEl.scrollTop > 8);
    on();
    scrollEl.addEventListener('scroll', on, { passive: true });
    return () => scrollEl.removeEventListener('scroll', on);
  }, [scrollEl]);

  return (
    <nav className={stuck ? 'lp-nav stuck' : 'lp-nav'}>
      <div className="nav-in">
        <LandingLogo />

        <button
          type="button"
          className={`nav-menu-btn${menuOpen ? ' on' : ''}`}
          aria-expanded={menuOpen}
          aria-label="Sections"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icons.menu size={18} />
        </button>

        <div className={`nav-links${menuOpen ? ' open' : ''}`}>
          {NAV_SECTIONS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
        </div>

        <div className="nav-right">
          <a className="nav-signin" href="/login">
            Sign in
          </a>
          <a className="btn btn-sm btn-primary" href="/register">
            Create account
          </a>
        </div>
      </div>
    </nav>
  );
}

/** Hero — split layout: copy on the left, animated editor on the right. */
export function LandingHero({ data }) {
  return (
    <header className="lp-hero" id="top">
      <div className="wrap hero-split">
        <div className="hero-in">
          <span className="eyebrow">
            <i />
            {data.eyebrow}
          </span>
          <h1 className="hero-t">
            {data.lines.map((l, i) => (
              <span
                key={l}
                className={i === data.lines.length - 1 ? 'l g' : 'l'}
              >
                {l}
              </span>
            ))}
          </h1>
          <p className="hero-sub">{data.sub}</p>
          {/* The note belongs beside the button, not under it: it is what the
              button costs you, and with one action left in the hero the room to
              its right would otherwise read as something missing. */}
          <div className="hero-cta">
            <a className="btn btn-lg btn-primary" href="/register">
              Start solving
              <Icons.send size={17} />
            </a>
            <p className="hero-note">{data.note}</p>
          </div>
        </div>
        <EditorMock />
      </div>
    </header>
  );
}
