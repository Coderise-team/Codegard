import React, { useEffect } from 'react';
import { LandingNav, LandingHero } from '../components/landing/LandingHeader';
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
 * Motion: a fixed background layer (grid + two accent orbs) parallaxes on
 * --sy, an accent glow follows the cursor on --mx/--my, and .rv elements
 * reveal once via IntersectionObserver. Every frame writes CSS variables
 * only — no per-frame layout. prefers-reduced-motion disables all of it.
 *
 * Props:
 *   data — landing content; see data/landingData.js
 */
export default function LandingPage({ data = landingDataDefault }) {
  // parallax + cursor glow
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        document.documentElement.style.setProperty('--sy', `${y}px`);
      });
    };
    const onMove = (e) => {
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`);
      document.documentElement.style.setProperty('--my', `${e.clientY}px`);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // scroll reveals
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.rv:not(.in)'));
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
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp">
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
  );
}
