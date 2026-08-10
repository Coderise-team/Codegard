import { useEffect } from 'react';

// Fades the landing's `.rv` elements in the first time they scroll into view,
// by adding `.in` to them; the transition itself lives in LandingPage.css.
// The class is flipped directly instead of being held in state because it is
// a one-way, presentation-only change, and one observer covers the whole page
// rather than one per section.
//
// The elements are collected once, when the scroll area appears. That is
// enough here because the landing renders every section up front.
export function useScrollReveal(container) {
  useEffect(() => {
    if (!container) return undefined;
    const elements = Array.from(container.querySelectorAll('.rv:not(.in)'));
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        });
      },
      { root: container, rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [container]);
}
