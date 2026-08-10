import { useEffect, useState } from 'react';
import { LandingNav, LandingHero } from '../components/landing/LandingHeader';
import { LandingScrollContext } from '../components/landing/scrollContext';
import LiveContest from '../components/landing/LiveContest';
import HowItWorks from '../components/landing/HowItWorks';
import GlobalStandings from '../components/landing/GlobalStandings';
import {
  JudgeSection,
  FaqSection,
  FinalCta,
  LandingFooter,
} from '../components/landing/LandingBlocks';
import landingDataDefault from '../components/landing/content';
import './LandingPage.css';

/**
 * LandingPage — the marketing entry point.
 *
 * Baked-in configuration (was the "Tweaks" panel in the prototype):
 *   • Hero: split   • Sections: all on   • Accent: violet (default tokens)
 *
 * The app shell keeps `body` from scrolling, so the page owns its scroll area
 * and publishes it through LandingScrollContext for the sections that react to
 * scrolling.
 *
 * Motion: a fixed background layer (grid + two accent orbs) parallaxes on
 * --sy, an accent glow follows the cursor on --mx/--my, and .rv elements
 * reveal once via IntersectionObserver. Every frame writes CSS variables
 * only — no per-frame layout. prefers-reduced-motion disables all of it.
 *
 * Props:
 *   data — landing content; see components/landing/content.js
 */
export default function LandingPage({ data = landingDataDefault }) {
  // The scroll area is kept in state rather than a ref so that the sections
  // below re-render once the node exists and can attach their own listeners.
  const [scrollEl, setScrollEl] = useState(null);

  // parallax + cursor glow
  useEffect(() => {
    if (!scrollEl) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scrollEl.style.setProperty('--sy', `${scrollEl.scrollTop}px`);
      });
    };
    const onMove = (e) => {
      scrollEl.style.setProperty('--mx', `${e.clientX}px`);
      scrollEl.style.setProperty('--my', `${e.clientY}px`);
    };
    onScroll();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    scrollEl.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener('scroll', onScroll);
      scrollEl.removeEventListener('pointermove', onMove);
    };
  }, [scrollEl]);

  // scroll reveals
  useEffect(() => {
    if (!scrollEl) return undefined;
    const els = Array.from(scrollEl.querySelectorAll('.rv:not(.in)'));
    if (!els.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { root: scrollEl, rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scrollEl]);

  return (
    <LandingScrollContext.Provider value={scrollEl}>
      <div className="lp scroll" ref={setScrollEl}>
        <div className="lp-bg">
          <div className="lp-grid" />
          <div className="lp-orb a" />
          <div className="lp-orb b" />
          <div className="lp-noise" />
        </div>
        <div className="lp-cursor" />

        <LandingNav />
        <LandingHero data={data.hero} />
        <LiveContest contest={data.contest} />
        <HowItWorks steps={data.steps} />
        <GlobalStandings
          podium={data.podium}
          table={data.table}
          ladder={data.ladder}
        />
        <JudgeSection items={data.judge} />
        <FaqSection items={data.faq} />
        <FinalCta />
        <LandingFooter />
      </div>
    </LandingScrollContext.Provider>
  );
}
