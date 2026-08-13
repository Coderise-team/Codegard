import { useEffect } from 'react';

// Fades the landing's `.rv` elements in as they scroll into view, by adding
// `.in` to them; the transition itself lives in LandingPage.css. The class is
// flipped directly instead of being held in state because it is a
// presentation-only change, and one observer covers the whole page rather than
// one per section.
//
// An element is put back to its hidden state once it has dropped below the
// bottom of the view — that only happens on the way up, and it means a second
// pass down the page plays exactly like the first. Leaving upward is left
// alone: those elements stay as they are, so scrolling back up never sets
// anything moving behind the reader.
//
// The elements are collected once, when the scroll area appears. That is
// enough here because the landing renders every section up front.
export function useScrollReveal(container) {
  useEffect(() => {
    if (!container) return undefined;
    const elements = Array.from(container.querySelectorAll('.rv'));
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in');
          // Below the view: we have scrolled back past it, so arm it again.
          else if (entry.boundingClientRect.top > 0)
            entry.target.classList.remove('in');
        });
      },
      { root: container, rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [container]);
}
