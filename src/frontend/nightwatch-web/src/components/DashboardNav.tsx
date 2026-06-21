import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const strategicRoutes = new Set([
  '/executive-cost-roi',
  '/cost-allocation',
  '/wastage-tracker',
  '/ri-savings',
  '/true-bu-shared-cost',
  '/inactive-user-license-mapping',
  '/lookback-seasonality-forecast',
  '/nonprod-uptime-leakage',
  '/aks-micro-billing',
  '/azure-unified-cost-security',
  '/executive-summary-slides',
  '/orphaned-resources',
  '/overprivileged-identities',
  '/tag-hygiene-compliance',

  '/sql-managed-instance',
  '/cosmos-performance',
  '/data-pipelines',
  '/app-service-health',
  '/apim-operations',
  '/microservices-map',
]);

const prefetchedRoutes = new Set<string>();

async function prefetchRouteChunk(route: string) {
  if (prefetchedRoutes.has(route)) {
    return;
  }

  prefetchedRoutes.add(route);

  if (strategicRoutes.has(route)) {
    await import('../pages/StrategicDashboardPage');
    return;
  }

  switch (route) {
    case '/':
      await import('../pages/ExecutiveDashboardPage');
      break;
    case '/security':
      await import('../pages/SecurityDashboardPage');
      break;
    case '/performance':
      await import('../pages/PerformanceDashboardPage');
      break;
    case '/cost':
      await import('../pages/CostDashboardPage');
      break;
    case '/capacity-planning':
      await import('../pages/CapacityPlanningDashboardPage');
      break;
    case '/spend-anomaly':
      await import('../pages/CostAnomalyForecastDashboardPage');
      break;
    case '/iam-review':
    case '/network-perimeter':
    case '/backup-health':
    case '/threat-map':
    case '/compute-scaling':
    case '/storage-iops':
    case '/aks-operations':
      await import('../pages/OperationalForecastDashboardPage');
      break;
    case '/governance':
      await import('../pages/GovernanceDashboardPage');
      break;
    case '/intelligence':
      await import('../pages/IntelligenceDashboardPage');
      break;
    case '/msp':
      await import('../pages/MspDashboardPage');
      break;
    case '/settings/operations':
      await import('../pages/OperationsConfigPage');
      break;
    case '/network-topology':
      await import('../pages/NetworkTopologyPage');
      break;
    case '/dr-recoverability':
      await import('../pages/DisasterRecoverabilityDashboardPage');
      break;
    case '/alerts':
      await import('../pages/AlertsDashboardPage');
      break;
    case '/expressroute':
      await import('../pages/ExpressRoutePage');
      break;
    case '/vwan':
      await import('../pages/VwanPage');
      break;
    case '/app-gateway':
      await import('../pages/AppGatewayPage');
      break;
    case '/vpn-gateway':
      await import('../pages/VpnGatewayPage');
      break;
    default:
      break;
  }
}

async function prefetchRoutesBatch(routes: string[]) {
  await Promise.all(routes.map(async (route) => prefetchRouteChunk(route)));
}

const likelyNextRoutes: Record<string, string[]> = {
  '/': ['/security', '/cost'],
  '/security': ['/performance', '/iam-review'],
  '/performance': ['/cost', '/compute-scaling'],
  '/cost': ['/executive-cost-roi', '/spend-anomaly'],
  '/governance': ['/iam-review', '/network-perimeter'],
  '/backup-health': ['/dr-recoverability', '/iam-review'],
  '/intelligence': ['/msp', '/executive-cost-roi'],
  '/msp': ['/executive-cost-roi', '/security'],
};

const navItems = [
  { to: '/', label: 'Executive' },
  { to: '/security', label: 'Security' },
  { to: '/performance', label: 'Performance' },
  { to: '/cost', label: 'Cost' },
  { to: '/capacity-planning', label: 'Capacity' },
  { to: '/governance', label: 'Governance' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/msp', label: 'MSP' },
  { to: '/executive-cost-roi', label: 'Exec ROI' },
  { to: '/cost-allocation', label: 'Allocation' },
  { to: '/wastage-tracker', label: 'Wastage' },
  { to: '/ri-savings', label: 'Savings' },
  { to: '/true-bu-shared-cost', label: 'BU Shared Cost' },
  { to: '/inactive-user-license-mapping', label: 'Inactive Owners' },
  { to: '/lookback-seasonality-forecast', label: 'Seasonality' },
  { to: '/nonprod-uptime-leakage', label: 'Uptime Leakage' },
  { to: '/aks-micro-billing', label: 'AKS Billing' },
  { to: '/azure-unified-cost-security', label: 'Azure Unified' },
  { to: '/executive-summary-slides', label: 'Exec Slides' },
  { to: '/orphaned-resources', label: 'Orphaned Resources' },
  { to: '/overprivileged-identities', label: 'MI Privilege' },
  { to: '/tag-hygiene-compliance', label: 'Tag Hygiene' },
  { to: '/spend-anomaly', label: 'Spend Alerts' },
  { to: '/iam-review', label: 'IAM Review' },
  { to: '/network-perimeter', label: 'Perimeter' },
  { to: '/backup-health', label: 'Backup' },
  { to: '/dr-recoverability', label: 'Disaster Recoverability' },
  { to: '/threat-map', label: 'Threat Map' },
  { to: '/compute-scaling', label: 'Compute' },
  { to: '/expressroute', label: 'Express Route' },
  { to: '/storage-iops', label: 'Storage IOPS' },
  { to: '/aks-operations', label: 'AKS Ops' },
  { to: '/sql-managed-instance', label: 'SQL/MI' },
  { to: '/cosmos-performance', label: 'Cosmos' },
  { to: '/data-pipelines', label: 'Pipelines' },
  { to: '/app-service-health', label: 'App Service' },
  { to: '/apim-operations', label: 'APIM' },
  { to: '/microservices-map', label: 'Microservices' },
  { to: '/network-topology', label: 'Network Topology' },
  { to: '/database-health', label: 'Databases' },
  { to: '/key-vault-health', label: 'Key Vaults' },
  { to: '/aks-container-health', label: 'AKS & Containers' },
  { to: '/storage-compliance', label: 'Storage' },
  { to: '/service-health', label: 'Svc Health' },
  { to: '/identity-attack-surface', label: 'Identity Attack Surface' },
  { to: '/managed-identity-audit', label: 'Identities' },
  { to: '/advisor-score', label: 'Advisor Score' },
  { to: '/messaging-health', label: 'Messaging' },
  { to: '/support-tickets', label: 'Support' },
  { to: '/vmss-health', label: 'VMSS' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/vwan', label: 'VWAN' },
  { to: '/app-gateway', label: 'App Gateway' },
  { to: '/vpn-gateway', label: 'VPN Gateway' },
  { to: '/tenants', label: 'Tenants' },
  { to: '/settings/operations', label: 'Settings' },
];

export function DashboardNav() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const nextRoutes = likelyNextRoutes[pathname];
    if (!nextRoutes || nextRoutes.length === 0) {
      return;
    }

    void prefetchRoutesBatch(nextRoutes);
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const activeItem = navItems.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
  );

  const navLinks = navItems.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      onMouseEnter={() => { void prefetchRouteChunk(item.to); }}
      onFocus={() => { void prefetchRouteChunk(item.to); }}
      className={({ isActive }) =>
        `rounded-xl px-4 py-2 text-sm font-semibold transition ${
          isActive
            ? 'border border-cyan-300/50 bg-cyan-400/20 text-cyan-50'
            : 'border border-white/10 bg-slate-950/40 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-100'
        }`
      }
    >
      {item.label}
    </NavLink>
  ));

  return (
    <nav>
      {/* Mobile: collapsible toggle */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm font-semibold text-slate-300"
          aria-expanded={mobileOpen}
        >
          <span>{activeItem?.label ?? 'Navigation'}</span>
          <svg
            className={`h-4 w-4 transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {mobileOpen && (
          <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-slate-900/90 p-3">
            {navLinks}
          </div>
        )}
      </div>

      {/* Desktop: wrap layout */}
      <div className="hidden md:flex flex-wrap gap-2">
        {navLinks}
      </div>
    </nav>
  );
}
