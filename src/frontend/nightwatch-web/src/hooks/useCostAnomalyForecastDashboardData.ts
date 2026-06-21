import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import type { CostAnomalyForecastDashboard } from '../types/dashboard';

export function useCostAnomalyForecastDashboardData(refreshTick: number, timeRange: string) {
  const [data, setData] = useState<CostAnomalyForecastDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await nightWatchClient.getCostAnomalyForecastDashboard(timeRange, refreshTick);
        setData(response);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load cost anomaly forecast data.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [refreshTick, timeRange]);

  return {
    data,
    isLoading,
    loadError,
    hasCoreData: Boolean(data),
  };
}
