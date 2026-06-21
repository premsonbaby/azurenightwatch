import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import type { StrategicDashboard } from '../types/dashboard';

export function useStrategicDashboardData(refreshTick: number, dashboardKey: string) {
  const [data, setData] = useState<StrategicDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await nightWatchClient.getStrategicDashboard(dashboardKey, refreshTick);
        setData(response);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load strategic dashboard data.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [refreshTick, dashboardKey]);

  return {
    data,
    isLoading,
    loadError,
    hasCoreData: Boolean(data),
  };
}
