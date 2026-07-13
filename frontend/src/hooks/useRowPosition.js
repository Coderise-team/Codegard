import { useEffect, useState } from 'react';

// How close to an edge of the scroll container a row may get before it counts
// as gone. Keeps the row from fighting a bar docked over that same edge.
const EDGE_PAD = 56;

/**
 * Where a row sits inside a scroll container: 'visible' while it is on screen,
 * 'above' once it has scrolled off the top, 'below' while it is still further
 * down. A row that is not rendered at all reads as 'below'.
 *
 * Returns [position, rowRef]. `rowRef` is a callback ref — attach it to the row
 * and the observer follows the node across re-renders and re-mounts.
 */
export function useRowPosition(rootRef) {
  const [position, setPosition] = useState('below');
  const [node, setNode] = useState(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPosition('visible');
          return;
        }
        const bounds = entry.rootBounds;
        if (!bounds) return;
        setPosition(
          entry.boundingClientRect.top < bounds.top ? 'above' : 'below'
        );
      },
      { root, rootMargin: `-${EDGE_PAD}px 0px` }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootRef, node]);

  return [node ? position : 'below', setNode];
}
