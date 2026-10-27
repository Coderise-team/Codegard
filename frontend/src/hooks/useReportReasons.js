import { useEffect, useState } from 'react';

import { getReportReasons } from '../api/problems';

// Loads the reasons a problem can be reported for ([{ id, name }]),
// for the report form's reason picker.
export function useReportReasons() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getReportReasons()
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}
