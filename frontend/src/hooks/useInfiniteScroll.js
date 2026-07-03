import { useEffect, useRef } from 'react';

// Returns a ref to attach to a sentinel element at the end of a list. When that
// sentinel scrolls into view (and `enabled` is true) `onLoadMore` is called.
// rootMargin pre-loads the next page a bit before the sentinel is visible.
export function useInfiniteScroll(onLoadMore, enabled) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadMore, enabled]);

  return ref;
}
