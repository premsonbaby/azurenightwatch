import { useEffect, useMemo, useRef, useState } from 'react';
import { nightWatchClient } from '../api/client';
import type {
  CostDashboard,
  ExecutiveDashboard,
  GovernanceDashboard,
  PerformanceDashboard,
  SecurityDashboard,
  SmartFeatures,
  TenantOverview,
} from '../types/dashboard';

export interface NightWatchDashboardData {
  executive: ExecutiveDashboard | null;
  security: SecurityDashboard | null;
  performance: PerformanceDashboard | null;
  cost: CostDashboard | null;
  governance: GovernanceDashboard | null;
  smart: SmartFeatures | null;
  tenants: TenantOverview[];
}

export type DashboardSection =
  | 'executive'
  | 'security'
  | 'performance'
  | 'cost'
  | 'governance'
  | 'intelligence'
  | 'msp';

const emptyState: NightWatchDashboardData = {
  executive: null,
  security: null,
  performance: null,
  cost: null,
  governance: null,
  smart: null,
  tenants: [],
};

export function useNightWatchDashboardData(refreshTick: number, section: DashboardSection) {
  const [data, setData] = useState<NightWatchDashboardData>(emptyState);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    async function loadAll() {
      setIsLoading(!hasLoadedOnceRef.current);
      setLoadError(null);

      try {
        const nextData: NightWatchDashboardData = { ...emptyState };

        switch (section) {
          case 'executive':
            nextData.executive = await nightWatchClient.getExecutiveDashboard(refreshTick);
            break;
          case 'security':
            nextData.security = await nightWatchClient.getSecurityDashboard(refreshTick);
            break;
          case 'performance':
            nextData.performance = await nightWatchClient.getPerformanceDashboard(refreshTick);
            break;
          case 'cost':
            nextData.cost = await nightWatchClient.getCostDashboard(refreshTick);
            break;
          case 'governance':
            nextData.governance = await nightWatchClient.getGovernanceDashboard(refreshTick);
            break;
          case 'intelligence':
            nextData.smart = await nightWatchClient.getSmartFeatures(refreshTick);
            break;
          case 'msp':
            nextData.tenants = await nightWatchClient.getAzureTenantOverview(refreshTick);
            break;
        }

        setData(nextData);
        setLastUpdated(new Date());
        hasLoadedOnceRef.current = true;
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load live dashboard data.');
        hasLoadedOnceRef.current = true;
      } finally {
        setIsLoading(false);
      }
    }

    void loadAll();
  }, [refreshTick, section]);

  const hasCoreData = useMemo(
    () => {
      switch (section) {
        case 'executive':
          return typeof data.executive?.azureHealthScore === 'number';
        case 'security':
          return Array.isArray(data.security?.findings);
        case 'performance':
          return typeof data.performance?.slaRiskScore === 'number';
        case 'cost':
          return typeof data.cost?.currentMonthCost === 'number';
        case 'governance':
          return typeof data.governance?.tagCompliancePercent === 'number';
        case 'intelligence':
          return Array.isArray(data.smart?.whatChanged);
        case 'msp':
          return data.tenants.length > 0;
        default:
          return false;
      }
    },
    [data, section],
  );

  return {
    ...data,
    hasCoreData,
    isLoading,
    loadError,
    lastUpdated,
  };
}