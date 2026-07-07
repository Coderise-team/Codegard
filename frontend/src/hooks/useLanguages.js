import { useEffect, useState } from 'react';

import { getLanguages } from '../api/submissions';

// Loads the supported judge languages with their editor starter templates.
export function useLanguages() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getLanguages()
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}
