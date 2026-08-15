import { useEffect, useState } from 'react';
import { LandingNav, LandingHero } from '../components/landing/LandingHeader';
import { LandingScrollContext } from '../hooks/useLandingScroll';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useSmoothScroll } from '../hooks/useSmoothScroll';
import { useReducedMotion } from '../hooks/useReducedMotion';
import LiveContest from '../components/landing/LiveContest';
import HowItWorks from '../components/landing/HowItWorks';
import SoloPractice from '../components/landing/SoloPractice';
import GlobalStandings from '../components/landing/GlobalStandings';
import {
  JudgeSection,
  FaqSection,
  FinalCta,
  LandingFooter,
} from '../components/landing/LandingBlocks';
import landingDataDefault from '../utils/landingContent';
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
 *   data — landing content; see utils/landingContent.js
 */
export default function LandingPage({ data = landingDataDefault }) {
  // The scroll area is kept in state rather than a ref so that the sections
  // below re-render once the node exists and can attach their own listeners.
  const [scrollEl, setScrollEl] = useState(null);
  const reduced = useReducedMotion();

  // Parallax and cursor glow. Both are switched off rather than painted over
  // when less motion is asked for: the stylesheet pins the layers in place
  // there anyway, so listening would be work done for nothing.
  //
  // A pointer reports far more often than the screen redraws, so the position
  // is written once a frame like the scroll offset. Both write a custom
  // property and nothing else — no layout is read, and the layers that use
  // them move on the compositor.
  useEffect(() => {
    if (!scrollEl || reduced) return undefined;
    let raf = 0;
    let pointer = null;

    const write = () => {
      raf = 0;
      scrollEl.style.setProperty('--sy', `${scrollEl.scrollTop}px`);
      if (!pointer) return;
      scrollEl.style.setProperty('--mx', `${pointer.x}px`);
      scrollEl.style.setProperty('--my', `${pointer.y}px`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onMove = (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      schedule();
    };

    write();
    scrollEl.addEventListener('scroll', schedule, { passive: true });
    scrollEl.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener('scroll', schedule);
      scrollEl.removeEventListener('pointermove', onMove);
    };
  }, [scrollEl, reduced]);

  useScrollReveal(scrollEl);
  useSmoothScroll(scrollEl, !reduced);

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
        <HowItWorks
          steps={data.steps}
          catalogue={data.solo.catalogue.slice(0, 4)}
          you={data.you}
        />
        <SoloPractice solo={data.solo} />
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
