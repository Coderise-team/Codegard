import { useState, useEffect } from 'react';
import Icons from '../Icons';
import EditorMock from './EditorMock';
import { useLandingScroll } from '../../hooks/useLandingScroll';

/** Brand lockup, links back to the landing root. */
export function LandingLogo({ href = '/' }) {
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

/** Sticky marketing header — gains a border once the page scrolls. */
export function LandingNav() {
  const scrollEl = useLandingScroll();
  const [stuck, setStuck] = useState(false);

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
        <div className="nav-links">
          <a href="#contests">Contests</a>
          <a href="#how">How it works</a>
          <a href="#rating">Rating</a>
          <a href="#faq">FAQ</a>
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
    <header className="lp-hero">
      <div className="wrap hero-split">
        <div className="rv in">
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
          <div className="hero-cta">
            <a className="btn btn-lg btn-primary" href="/register">
              Start solving
              <Icons.send size={17} />
            </a>
            <a className="btn btn-lg" href="/problems">
              Browse problems
            </a>
          </div>
          <p className="hero-note">{data.note}</p>
        </div>
        <EditorMock />
      </div>
    </header>
  );
}
