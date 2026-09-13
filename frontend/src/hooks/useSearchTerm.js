import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The search term of a list page, kept in the address as `?search=`.
 *
 * There so a search can be handed to someone as a link and so Back steps out of
 * it instead of leaving the page. Returns [term, setTerm]; an empty term drops
 * the parameter rather than leaving `?search=` behind.
 */
export function useSearchTerm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const term = searchParams.get('search') ?? '';

  const setTerm = useCallback(
    (next) =>
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set('search', next);
        else params.delete('search');
        return params;
      }),
    [setSearchParams]
  );

  return [term, setTerm];
}
