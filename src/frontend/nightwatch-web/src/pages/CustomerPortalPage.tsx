import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { isMsalEnabled, getApiScopes, getApiBaseUrl } from '../auth/authConfig';
import { setActiveTenantId } from '../api/client';

// ── Dashboard pages reused from the main portal ──────────────────────────────

const ExecutiveDashboardPage = lazy(() =>
  import('./ExecutiveDashboardPage').then((m) => ({ default: m.ExecutiveDashboardPage })),
);
const SecurityDashboardPage = lazy(() =>
  import('./SecurityDashboardPage').then((m) => ({ default: m.SecurityDashboardPage })),
);
const CostDashboardPage = lazy(() =>
  import('./CostDashboardPage').then((m) => ({ default: m.CostDashboardPage })),
);
const GovernanceDashboardPage = lazy(() =>
  import('./GovernanceDashboardPage').then((m) => ({ default: m.GovernanceDashboardPage })),
);
const PerformanceDashboardPage = lazy(() =>
  import('./PerformanceDashboardPage').then((m) => ({ default: m.PerformanceDashboardPage })),
);
const AzureChangesPage = lazy(() =>
  import('./AzureChangesPage').then((m) => ({ default: m.AzureChangesPage })),
);
const OrphanedResourcesPage = lazy(() =>
  import('./OrphanedResourcesPage').then((m) => ({ default: m.OrphanedResourcesPage })),
);
const TagHygienePage = lazy(() =>
  import('./TagHygienePage').then((m) => ({ default: m.TagHygienePage })),
);
const CapacityPlanningDashboardPage = lazy(() =>
  import('./CapacityPlanningDashboardPage').then((m) => ({ default: m.CapacityPlanningDashboardPage })),
);
const WastageTrackerFull = lazy(() =>
  import('./WastageTrackerPage').then((m) => ({ default: m.WastageTrackerPage })),
);
const RiSavingsPage = lazy(() =>
  import('./RiSavingsPage').then((m) => ({ default: m.RiSavingsPage })),
);
const DatabaseHealthPage = lazy(() =>
  import('./DatabaseHealthPage').then((m) => ({ default: m.DatabaseHealthPage })),
);
const AksContainerHealthPage = lazy(() =>
  import('./AksContainerHealthPage').then((m) => ({ default: m.AksContainerHealthPage })),
);
const KeyVaultHealthPage = lazy(() =>
  import('./KeyVaultHealthPage').then((m) => ({ default: m.KeyVaultHealthPage })),
);
const StorageCompliancePage = lazy(() =>
  import('./StorageCompliancePage').then((m) => ({ default: m.StorageCompliancePage })),
);
const ServiceHealthPageFull = lazy(() =>
  import('./ServiceHealthPage').then((m) => ({ default: m.ServiceHealthPage })),
);
const AlertsDashboardPage = lazy(() =>
  import('./AlertsDashboardPage').then((m) => ({ default: m.AlertsDashboardPage })),
);
const ManagedIdentityAuditPage = lazy(() =>
  import('./ManagedIdentityAuditPage').then((m) => ({ default: m.ManagedIdentityAuditPage })),
);
const NetworkPerimeterPage = lazy(() =>
  import('./NetworkPerimeterPage').then((m) => ({ default: m.NetworkPerimeterPage })),
);
const IntelligenceDashboardPage = lazy(() =>
  import('./IntelligenceDashboardPage').then((m) => ({ default: m.IntelligenceDashboardPage })),
);
const AdvisorScorePageFull = lazy(() =>
  import('./AdvisorScorePage').then((m) => ({ default: m.AdvisorScorePage })),
);
const TopCostlyResourcesPage = lazy(() =>
  import('./TopCostlyResourcesPage').then((m) => ({ default: m.TopCostlyResourcesPage })),
);
const SubscriptionCostPage = lazy(() =>
  import('./SubscriptionCostPage').then((m) => ({ default: m.SubscriptionCostPage })),
);
const NonProdUptimePage = lazy(() =>
  import('./NonProdUptimePage').then((m) => ({ default: m.NonProdUptimePage })),
);
const DisasterRecoverabilityDashboardPage = lazy(() =>
  import('./DisasterRecoverabilityDashboardPage').then((m) => ({ default: m.DisasterRecoverabilityDashboardPage })),
);
const AppFunctionsHealthPage = lazy(() =>
  import('./AppFunctionsHealthPage').then((m) => ({ default: m.AppFunctionsHealthPage })),
);
const NetworkTopologyPage = lazy(() =>
  import('./NetworkTopologyPage').then((m) => ({ default: m.NetworkTopologyPage })),
);
const CostAnomalyForecastDashboardPage = lazy(() =>
  import('./CostAnomalyForecastDashboardPage').then((m) => ({ default: m.CostAnomalyForecastDashboardPage })),
);
const IdentityAttackSurfacePage = lazy(() =>
  import('./IdentityAttackSurfacePage').then((m) => ({ default: m.IdentityAttackSurfacePage })),
);
const MessagingHealthPage = lazy(() =>
  import('./MessagingHealthPage').then((m) => ({ default: m.MessagingHealthPage })),
);
const SupportTicketPage = lazy(() =>
  import('./SupportTicketPage').then((m) => ({ default: m.SupportTicketPage })),
);
const VmssHealthPage = lazy(() =>
  import('./VmssHealthPage').then((m) => ({ default: m.VmssHealthPage })),
);
const ExpressRoutePage = lazy(() => import('./ExpressRoutePage'));
const VwanPage = lazy(() => import('./VwanPage'));
const AzureFirewallPage = lazy(() => import('./AzureFirewallPage'));
const AppGatewayPage = lazy(() => import('./AppGatewayPage'));
const VpnGatewayPage = lazy(() => import('./VpnGatewayPage'));

// ── Dashboard registry ────────────────────────────────────────────────────────

interface PortalDashboard {
  key: string;
  label: string;
  path: string; // relative to /portal
  component: (props: { refreshTick: number }) => ReactNode;
}

export const ALL_PORTAL_DASHBOARDS: PortalDashboard[] = [
  // Core
  { key: 'security',                label: 'Security Intelligence',    path: 'security',                 component: (p) => <SecurityDashboardPage {...p} /> },
  { key: 'cost',                    label: 'Cost Optimization',        path: 'cost',                     component: (p) => <CostDashboardPage {...p} /> },
  { key: 'governance',              label: 'Governance',               path: 'governance',               component: (p) => <GovernanceDashboardPage {...p} /> },
  { key: 'performance',             label: 'Performance',              path: 'performance',              component: (p) => <PerformanceDashboardPage {...p} /> },
  { key: 'intelligence',            label: 'AI Intelligence',          path: 'intelligence',             component: (p) => <IntelligenceDashboardPage {...p} /> },
  // Operations
  { key: 'advisor-score',           label: 'Advisor Score',            path: 'advisor-score',            component: (p) => <AdvisorScorePageFull {...p} /> },
  { key: 'service-health',          label: 'Service Health',           path: 'service-health',           component: (p) => <ServiceHealthPageFull {...p} /> },
  { key: 'azure-changes',           label: 'Azure Changes',            path: 'azure-changes',            component: (p) => <AzureChangesPage {...p} /> },
  { key: 'alerts',                  label: 'Azure Monitor Alerts',     path: 'alerts',                   component: (p) => <AlertsDashboardPage {...p} /> },
  { key: 'wastage-tracker',         label: 'Wastage Tracker',          path: 'wastage-tracker',          component: (p) => <WastageTrackerFull {...p} /> },
  { key: 'ri-savings',              label: 'RI & Savings',             path: 'ri-savings',               component: (p) => <RiSavingsPage {...p} /> },
  { key: 'top-costly-resources',    label: 'Top Costly Resources',     path: 'top-costly-resources',     component: (p) => <TopCostlyResourcesPage {...p} /> },
  { key: 'subscription-cost',       label: 'Subscription Cost',        path: 'subscription-cost',        component: (p) => <SubscriptionCostPage {...p} /> },
  { key: 'nonprod-uptime-leakage',  label: 'Non-Prod Uptime',          path: 'nonprod-uptime-leakage',   component: (p) => <NonProdUptimePage {...p} /> },
  { key: 'capacity-planning',       label: 'Capacity Planning',        path: 'capacity-planning',        component: (p) => <CapacityPlanningDashboardPage {...p} /> },
  { key: 'spend-anomaly',           label: 'Spend Anomaly & Forecast', path: 'spend-anomaly',            component: (p) => <CostAnomalyForecastDashboardPage {...p} /> },
  { key: 'network-topology',        label: 'Network Topology',         path: 'network-topology',         component: (p) => <NetworkTopologyPage {...p} /> },
  // Security & Compliance
  { key: 'orphaned-resources',      label: 'Orphaned Resources',       path: 'orphaned-resources',       component: (p) => <OrphanedResourcesPage {...p} /> },
  { key: 'tag-hygiene-compliance',  label: 'Tag Hygiene',              path: 'tag-hygiene-compliance',   component: (p) => <TagHygienePage {...p} /> },
  { key: 'network-perimeter',       label: 'Network Perimeter',        path: 'network-perimeter',        component: (p) => <NetworkPerimeterPage {...p} /> },
  { key: 'dr-recoverability',       label: 'Disaster Recoverability',  path: 'dr-recoverability',        component: (p) => <DisasterRecoverabilityDashboardPage {...p} /> },
  { key: 'managed-identity-audit',  label: 'Managed Identity Audit',   path: 'managed-identity-audit',   component: (p) => <ManagedIdentityAuditPage {...p} /> },
  { key: 'identity-attack-surface', label: 'Identity Attack Surface',  path: 'identity-attack-surface',  component: (p) => <IdentityAttackSurfacePage {...p} /> },
  // Platform & Data
  { key: 'app-functions-health',    label: 'App Service Health',       path: 'app-functions-health',     component: (p) => <AppFunctionsHealthPage {...p} /> },
  { key: 'database-health',         label: 'Database Health',          path: 'database-health',          component: (p) => <DatabaseHealthPage {...p} /> },
  { key: 'aks-container-health',    label: 'AKS & Container Health',   path: 'aks-container-health',     component: (p) => <AksContainerHealthPage {...p} /> },
  { key: 'key-vault-health',        label: 'Key Vault Health',         path: 'key-vault-health',         component: (p) => <KeyVaultHealthPage {...p} /> },
  { key: 'storage-compliance',      label: 'Storage Compliance',       path: 'storage-compliance',       component: (p) => <StorageCompliancePage {...p} /> },
  { key: 'messaging-health',        label: 'Messaging Health',         path: 'messaging-health',         component: (p) => <MessagingHealthPage {...p} /> },
  { key: 'vmss-health',             label: 'VMSS Health',              path: 'vmss-health',              component: (p) => <VmssHealthPage {...p} /> },
  { key: 'support-tickets',         label: 'Support Ticket Tracker',   path: 'support-tickets',          component: (p) => <SupportTicketPage {...p} /> },
  // Networking
  { key: 'expressroute',            label: 'Express Route',            path: 'expressroute',             component: () => <ExpressRoutePage /> },
  { key: 'vwan',                    label: 'Virtual WAN',              path: 'vwan',                     component: () => <VwanPage /> },
  { key: 'azure-firewall',          label: 'Azure Firewall',           path: 'azure-firewall',           component: () => <AzureFirewallPage /> },
  { key: 'app-gateway',             label: 'Application Gateway',      path: 'app-gateway',              component: () => <AppGatewayPage /> },
  { key: 'vpn-gateway',             label: 'VPN Gateway',              path: 'vpn-gateway',              component: () => <VpnGatewayPage /> },
];

// ── Portal config type ────────────────────────────────────────────────────────

interface PortalConfig {
  tenantId: string;
  displayName: string;
  visibleDashboards: string[];
}

// ── Customer portal shell ─────────────────────────────────────────────────────

function CustomerPortalShell({ config }: { config: PortalConfig }) {
  const { instance, accounts } = useMsal();
  const { pathname } = useLocation();
  const [refreshTick, setRefreshTick] = useState(0);
  const isOnHome = pathname === '/portal' || pathname === '/portal/';

  const visibleDashboards = ALL_PORTAL_DASHBOARDS.filter((d) =>
    config.visibleDashboards.includes(d.key),
  );

  return (
    <div className="min-h-screen bg-atmosphere px-3 py-6 text-zinc-100 sm:px-5 lg:px-8">
      {/* Branded header */}
      <header className="mx-auto mb-6 flex w-full max-w-[1800px] items-center justify-between rounded-3xl border border-white/10 bg-zinc-500 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <img src="/nightwatch-icon.svg" alt="NightWatch" className="h-14 w-14 shrink-0 drop-shadow-[0_0_8px_rgba(87,185,255,0.5)]" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#c0c0c0]">Operations Intelligence Platform</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Azure Night Watch <span className="font-normal text-[#c0c0c0]">· {config.displayName}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOnHome && (
            <Link
              to="/portal"
              title="Back to Overview"
              className="rounded-xl border border-slate-400/40 bg-zinc-500/20 p-2.5 text-zinc-100 hover:bg-zinc-500/30 transition"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.8V21h14V9.8" />
              </svg>
            </Link>
          )}
          <button
            type="button"
            title="Refresh"
            className="rounded-xl border border-white/30 bg-white/15 p-2.5 text-red-400"
            onClick={() => setRefreshTick((v) => v + 1)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
            </svg>
          </button>
          {isMsalEnabled() && accounts.length > 0 && (
            <button
              type="button"
              title={`Sign out (${accounts[0].username})`}
              className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2.5 text-rose-300 hover:bg-rose-500/20 transition"
              onClick={() => instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Dashboard content */}
      <main className="mx-auto w-full max-w-[1800px]">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/10 bg-zinc-500 p-6 text-sm text-zinc-300">
              Loading dashboard...
            </div>
          }
        >
          <Routes>
            {/* Home — executive dashboard with operator-configured widgets */}
            <Route
              path="/"
              element={
                <ExecutiveDashboardPage
                  refreshTick={refreshTick}
                  basePath="/portal"
                  portalTenantId={config.tenantId}
                  portalWidgetKeys={config.visibleDashboards}
                />
              }
            />
            {visibleDashboards.map((d) => (
              <Route key={d.key} path={d.path} element={d.component({ refreshTick })} />
            ))}
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="mx-auto mt-6 flex w-full max-w-[1800px] justify-end px-1">
        <span className="select-none rounded-md border border-white/10 bg-zinc-500 px-2.5 py-1 font-mono text-[10px] text-zinc-500">
          Powered by Azure Night Watch
        </span>
      </footer>
    </div>
  );
}

// ── Not-a-customer error page ─────────────────────────────────────────────────

function NotACustomerPage({ reason }: { reason: string }) {
  const { instance, accounts } = useMsal();
  return (
    <div className="min-h-screen bg-zinc-500 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-500 p-8 text-center shadow-2xl">
        <img src="/nightwatch-icon.svg" alt="NightWatch" className="mx-auto mb-6 h-16 w-16 drop-shadow-[0_0_8px_rgba(87,185,255,0.4)]" />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20">
          <svg className="h-8 w-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-white">Access Not Available</h1>
        <p className="mt-3 text-sm text-zinc-300">{reason}</p>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={() => instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-500"
          >
            Sign out and try a different account
          </button>
        )}
        <p className="mt-4 text-xs text-zinc-400">Contact your service provider if you believe this is an error.</p>
      </div>
    </div>
  );
}

// ── Customer portal guard ─────────────────────────────────────────────────────

export function CustomerPortalGuard() {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress, instance } = useMsal();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; config: PortalConfig }
    | { status: 'error'; reason: string }
  >({ status: 'loading' });

  useEffect(() => {
    if (!isMsalEnabled()) {
      // Dev mode — simulate a customer portal with a test tenant
      setActiveTenantId('tenant-a');
      setState({
        status: 'ready',
        config: {
          tenantId: 'tenant-a',
          displayName: 'Demo Customer',
          visibleDashboards: ['security', 'cost', 'advisor-score', 'service-health', 'azure-changes', 'governance'],
        },
      });
      return;
    }

    if (inProgress !== InteractionStatus.None) return;

    if (!isAuthenticated) {
      // Save target path so main.tsx can restore it after the redirect completes.
      // We use the root redirect URI because only that is registered on the app registration.
      sessionStorage.setItem('nightwatch:auth-return-path', '/portal');
      instance.loginRedirect({ scopes: getApiScopes(), redirectUri: window.location.origin });
      return;
    }

    const account = instance.getActiveAccount();
    const scopes = getApiScopes();

    void (async () => {
      try {
        const tokenResponse = await instance.acquireTokenSilent({ scopes, account: account ?? undefined });
        // Point all API calls at this customer's tenant
        const tid = (account?.idTokenClaims as Record<string, unknown>)?.tid as string | undefined;
        if (tid) setActiveTenantId(tid);

        // Validate against backend — checks tid is a registered customer
        const res = await fetch(`${getApiBaseUrl()}/api/customer/portal-config`, {
          headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
        });

        if (res.status === 403) {
          const body = await res.json().catch(() => ({ error: 'Not authorised.' }));
          setState({ status: 'error', reason: body.error ?? 'Your organisation is not registered.' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', reason: 'Unable to load portal configuration. Please try again.' });
          return;
        }

        const config: PortalConfig = await res.json();
        setActiveTenantId(config.tenantId);

        // Pre-populate the executive layout with the operator-configured dashboards
        // so the home page shows widgets immediately without a "No widgets selected" message.
        await fetch(`${getApiBaseUrl()}/api/dashboard/executive-layout/${config.tenantId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
            'Content-Type': 'application/json',
            'X-Tenant-Id': config.tenantId,
          },
          body: JSON.stringify({ widgetKeys: config.visibleDashboards }),
        }).catch(() => {});

        setState({ status: 'ready', config });
      } catch {
        setState({ status: 'error', reason: 'Authentication failed. Please refresh and try again.' });
      }
    })();
  }, [isAuthenticated, inProgress, instance]);

  if (!isMsalEnabled() && state.status === 'loading') {
    return null; // shouldn't happen — dev mode sets state synchronously
  }

  if (inProgress !== InteractionStatus.None || state.status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-500 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-transparent" />
      </div>
    );
  }

  if (state.status === 'error') {
    return <NotACustomerPage reason={state.reason} />;
  }

  return <CustomerPortalShell config={state.config} />;
}
