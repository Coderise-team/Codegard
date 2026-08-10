import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// Whether the viewer asked their system to reduce motion — the setting people
// switch on when animation makes them dizzy or sick. Components use it to skip
// an animation and render its finished frame instead.
//
// The value is subscribed to rather than read once, so flipping the system
// setting takes effect without reloading the page.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.(QUERY).matches ?? false
  );

  useEffect(() => {
    const query = window.matchMedia?.(QUERY);
    if (!query) return undefined;
    const onChange = (event) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
