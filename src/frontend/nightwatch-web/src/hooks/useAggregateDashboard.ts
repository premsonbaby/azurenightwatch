import { useState, useEffect, useRef } from 'react';
import { nightWatchClient } from '../api/client';
import type { AggregateDashboard } from '../types/dashboard';

export function useAggregateDashboard(refreshTick?: string | number) {
  const [data, setData] = useState<AggregateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setLoading(true);

    nightWatchClient.getAggregateDashboard(refreshTick)
      .then((result) => {
        if (isMountedRef.current) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
          setLoading(false);
        }
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [refreshTick]);

  return { data, loading, error };
}
