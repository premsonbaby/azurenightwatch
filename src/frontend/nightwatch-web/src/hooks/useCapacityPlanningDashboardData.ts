import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import type { CapacityPlanningDashboard } from '../types/dashboard';

export function useCapacityPlanningDashboardData(refreshTick: number, timeRange: string) {
  const [data, setData] = useState<CapacityPlanningDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await nightWatchClient.getCapacityPlanningDashboard(timeRange, refreshTick);
        setData(response);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load capacity planning data.');
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