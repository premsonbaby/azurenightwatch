import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, ErrorInfo } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CommandPalette } from './components/CommandPalette';
import { useGlobalKeyboardShortcuts, KeyboardShortcutsHelp } from './components/KeyboardShortcuts';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { ThemeToggle } from './components/ThemeToggle';
import { clearCache, nightWatchClient } from './api/client';
import { isMsalEnabled, getApiScopes, getApiBaseUrl } from './auth/authConfig';
import { TenantProvider, useTenant } from './context/TenantContext';
import { ConsentCallbackPage } from './pages/ConsentCallbackPage';
import type { CustomerTenant } from './types/tenant';

class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[RouteErrorBoundary]', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">Page Render Error</p>
          <p className="mt-2 font-mono text-xs text-rose-200">{(this.state.error as Error).message}</p>
          <button type="button" className="mt-4 rounded border border-rose-400/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10" onClick={() => this.setState({ error: null })}>Dismiss</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ExecutiveDashboardPage = lazy(() =>
  import('./pages/ExecutiveDashboardPage').then((module) => ({ default: module.ExecutiveDashboardPage })),
);
const SecurityDashboardPage = lazy(() =>
  import('./pages/SecurityDashboardPage').then((module) => ({ default: module.SecurityDashboardPage })),
);
const PerformanceDashboardPage = lazy(() =>
  import('./pages/PerformanceDashboardPage').then((module) => ({ default: module.PerformanceDashboardPage })),
);
const CostDashboardPage = lazy(() =>
  import('./pages/CostDashboardPage').then((module) => ({ default: module.CostDashboardPage })),
);
const CapacityPlanningDashboardPage = lazy(() =>
  import('./pages/CapacityPlanningDashboardPage').then((module) => ({ default: module.CapacityPlanningDashboardPage })),
);
const CostAnomalyForecastDashboardPage = lazy(() =>
  import('./pages/CostAnomalyForecastDashboardPage').then((module) => ({ default: module.CostAnomalyForecastDashboardPage })),
);
const GovernanceDashboardPage = lazy(() =>
  import('./pages/GovernanceDashboardPage').then((module) => ({ default: module.GovernanceDashboardPage })),
);
const IntelligenceDashboardPage = lazy(() =>
  import('./pages/IntelligenceDashboardPage').then((module) => ({ default: module.IntelligenceDashboardPage })),
);
const MspDashboardPage = lazy(() =>
  import('./pages/MspDashboardPage').then((module) => ({ default: module.MspDashboardPage })),
);
const StrategicDashboardPage = lazy(() =>
  import('./pages/StrategicDashboardPage').then((module) => ({ default: module.StrategicDashboardPage })),
);
const AppFunctionsHealthPage = lazy(() =>
  import('./pages/AppFunctionsHealthPage').then((module) => ({ default: module.AppFunctionsHealthPage })),
);
const PolicyRadarPage = lazy(() =>
  import('./pages/AzPolicyLensPage').then((module) => ({ default: module.AzPolicyLensPage })),
);
const OperationalForecastDashboardPage = lazy(() =>
  import('./pages/OperationalForecastDashboardPage').then((module) => ({ default: module.OperationalForecastDashboardPage })),
);
const ResourceDeepDivePage = lazy(() =>
  import('./pages/ResourceDeepDivePage').then((module) => ({ default: module.ResourceDeepDivePage })),
);
const OperationsConfigPage = lazy(() =>
  import('./pages/OperationsConfigPage').then((module) => ({ default: module.OperationsConfigPage })),
);
const NetworkTopologyPage = lazy(() =>
  import('./pages/NetworkTopologyPage').then((module) => ({ default: module.NetworkTopologyPage })),
);
const DisasterRecoverabilityDashboardPage = lazy(() =>
  import('./pages/DisasterRecoverabilityDashboardPage').then((module) => ({ default: module.DisasterRecoverabilityDashboardPage })),
);
const QuickWinsPage = lazy(() =>
  import('./pages/QuickWinsPage').then((module) => ({ default: module.QuickWinsPage })),
);
const TopCostlyResourcesPage = lazy(() =>
  import('./pages/TopCostlyResourcesPage').then((module) => ({ default: module.TopCostlyResourcesPage })),
);
const AzureChangesPage = lazy(() =>
  import('./pages/AzureChangesPage').then((module) => ({ default: module.AzureChangesPage })),
);
const WastageTrackerPage = lazy(() =>
  import('./pages/WastageTrackerPage').then((module) => ({ default: module.WastageTrackerPage })),
);
const RiSavingsPage = lazy(() =>
  import('./pages/RiSavingsPage').then((module) => ({ default: module.RiSavingsPage })),
);
const SubscriptionCostPage = lazy(() =>
  import('./pages/SubscriptionCostPage').then((module) => ({ default: module.SubscriptionCostPage })),
);
const OrphanedResourcesPage = lazy(() =>
  import('./pages/OrphanedResourcesPage').then((module) => ({ default: module.OrphanedResourcesPage })),
);
const TagHygienePage = lazy(() =>
  import('./pages/TagHygienePage').then((module) => ({ default: module.TagHygienePage })),
);
const NonProdUptimePage = lazy(() =>
  import('./pages/NonProdUptimePage').then((module) => ({ default: module.NonProdUptimePage })),
);
const DatabaseHealthPage = lazy(() =>
  import('./pages/DatabaseHealthPage').then((module) => ({ default: module.DatabaseHealthPage })),
);
const KeyVaultHealthPage = lazy(() =>
  import('./pages/KeyVaultHealthPage').then((module) => ({ default: module.KeyVaultHealthPage })),
);
const AksContainerHealthPage = lazy(() =>
  import('./pages/AksContainerHealthPage').then((module) => ({ default: module.AksContainerHealthPage })),
);
const StorageCompliancePage = lazy(() =>
  import('./pages/StorageCompliancePage').then((module) => ({ default: module.StorageCompliancePage })),
);
const ServiceHealthPage = lazy(() =>
  import('./pages/ServiceHealthPage').then((module) => ({ default: module.ServiceHealthPage })),
);
const ManagedIdentityAuditPage = lazy(() =>
  import('./pages/ManagedIdentityAuditPage').then((module) => ({ default: module.ManagedIdentityAuditPage })),
);
const AdvisorScorePage = lazy(() =>
  import('./pages/AdvisorScorePage').then((module) => ({ default: module.AdvisorScorePage })),
);
const MessagingHealthPage = lazy(() =>
  import('./pages/MessagingHealthPage').then((module) => ({ default: module.MessagingHealthPage })),
);
const SupportTicketPage = lazy(() =>
  import('./pages/SupportTicketPage').then((module) => ({ default: module.SupportTicketPage })),
);
const VmssHealthPage = lazy(() =>
  import('./pages/VmssHealthPage').then((module) => ({ default: module.VmssHealthPage })),
);
const AlertsDashboardPage = lazy(() =>
  import('./pages/AlertsDashboardPage').then((module) => ({ default: module.AlertsDashboardPage })),
);
const ExpressRoutePage = lazy(() => import('./pages/ExpressRoutePage'));
const VwanPage = lazy(() => import('./pages/VwanPage'));
const AzureFirewallPage = lazy(() => import('./pages/AzureFirewallPage'));
const AppGatewayPage = lazy(() => import('./pages/AppGatewayPage'));
const VpnGatewayPage = lazy(() => import('./pages/VpnGatewayPage'));
const IdentityAttackSurfacePage = lazy(() =>
  import('./pages/IdentityAttackSurfacePage').then((module) => ({ default: module.IdentityAttackSurfacePage })),
);
const NetworkPerimeterPage = lazy(() =>
  import('./pages/NetworkPerimeterPage').then((module) => ({ default: module.NetworkPerimeterPage })),
);
const TenantsPage = lazy(() =>
  import('./pages/TenantsPage').then((module) => ({ default: module.TenantsPage })),
);
const AlertsDigestPage = lazy(() =>
  import('./pages/AlertsDigestPage').then((module) => ({ default: module.AlertsDigestPage })),
);
const AlertThresholdsPage = lazy(() =>
  import('./pages/AlertThresholdsPage').then((module) => ({ default: module.AlertThresholdsPage })),
);
const AuditLogPage = lazy(() =>
  import('./pages/AuditLogPage').then((module) => ({ default: module.AuditLogPage })),
);
const MonthlyReviewPage = lazy(() =>
  import('./pages/MonthlyReviewPage').then((module) => ({ default: module.MonthlyReviewPage })),
);
const ReportHistoryPage = lazy(() =>
  import('./pages/ReportHistoryPage').then((module) => ({ default: module.ReportHistoryPage })),
);
const ReportSchedulePage = lazy(() =>
  import('./pages/ReportSchedulePage').then((module) => ({ default: module.ReportSchedulePage })),
);
const ScoreHistoryPage = lazy(() =>
  import('./pages/ScoreHistoryPage').then((module) => ({ default: module.ScoreHistoryPage })),
);

function TenantSwitcher({ onSwitch }: { onSwitch: () => void }) {
  const { activeTenantName, switchTenant, isHomeTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<CustomerTenant[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    nightWatchClient.getCustomerTenants()
      .then(setTenants)
      .catch(() => {});
  }, [open]);

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
          isHomeTenant
            ? 'border-slate-500/40 bg-slate-600/20 text-slate-200 hover:bg-slate-500/20'
            : 'border-violet-400/40 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${isHomeTenant ? 'bg-cyan-400' : 'bg-violet-400'}`} />
        {activeTenantName}
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div className="fixed z-[9999] w-64 rounded-xl border border-white/15 bg-slate-900 py-1 shadow-2xl"
               style={{ top: dropPos.top, right: dropPos.right }}>
            <button
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-700/50 ${isHomeTenant ? 'text-cyan-300' : 'text-slate-300'}`}
              onClick={() => { switchTenant('global', 'Home Tenant'); onSwitch(); setOpen(false); }}
            >
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Home Tenant
            </button>
            {tenants.length > 0 && (
              <div className="my-1 border-t border-white/10" />
            )}
            {tenants.map((t) => (
              <button
                key={t.tenantId}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-700/50 ${!isHomeTenant && activeTenantName === t.displayName ? 'text-violet-300' : 'text-slate-300'}`}
                onClick={() => { switchTenant(t.tenantId, t.displayName); onSwitch(); setOpen(false); }}
              >
                <span className={`h-2 w-2 rounded-full ${t.isActive ? 'bg-violet-400' : 'bg-slate-500'}`} />
                {t.displayName}
                {!t.lastVerifiedAt && <span className="ml-auto text-amber-400 text-[10px]">unverified</span>}
              </button>
            ))}
            <div className="my-1 border-t border-white/10" />
            <Link
              to="/tenants"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition hover:bg-slate-700/50"
              onClick={() => setOpen(false)}
            >
              Manage Tenants →
            </Link>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function AppShell() {
  const [isDark, setIsDark] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isHtmlExporting, setIsHtmlExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const refreshingRef = useRef(false);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { activeTenantName } = useTenant();
  const { pathname } = useLocation();
  const showHomeButton = pathname !== '/';
  const showGlobalExportButtons = pathname === '/';

  useEffect(() => {
    const interval = setInterval(() => setRefreshTick((value) => value + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleHardRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    clearCache();
    try { await nightWatchClient.clearServerCache(); } catch { /* best-effort */ }
    setRefreshTick((value) => value + 1);
    setIsRefreshing(false);
    refreshingRef.current = false;
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const { helpOpen, setHelpOpen } = useGlobalKeyboardShortcuts({
    onRefresh: handleHardRefresh,
    onOpenPalette: () => setPaletteOpen(true),
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <div className="min-h-screen bg-atmosphere px-3 py-6 text-slate-100 sm:px-5 lg:px-8 2xl:px-12">
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <KeyboardShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
        <header className="mx-auto mb-6 flex w-full max-w-[1800px] flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <img src="/nightwatch-icon.svg" alt="Azure Night Watch" className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-cyan-300">Operations Intelligence Platform</p>
                <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white sm:text-4xl">Azure Night Watch</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Search / command palette trigger */}
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                title="Search pages (Ctrl+K)"
                aria-label="Open command palette"
                className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-500/30 bg-slate-700/30 px-3 py-2 text-xs text-slate-400 hover:border-cyan-500/40 hover:text-cyan-100 transition"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <span>Search</span>
                <kbd className="ml-1 border border-slate-600 rounded px-1">Ctrl+K</kbd>
              </button>
              <TenantSwitcher onSwitch={() => {
                clearCache();
                nightWatchClient.clearServerCache().catch(() => {});
                setRefreshTick((v) => v + 1);
                setIsSwitchingTenant(true);
                if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
                switchTimerRef.current = setTimeout(() => setIsSwitchingTenant(false), 4000);
              }} />
              {showHomeButton ? (
                <Link
                  to="/"
                  title="Home"
                  aria-label="Home"
                  className="rounded-xl border border-slate-400/40 bg-slate-500/20 p-2.5 text-slate-100"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 10.5 12 3l9 7.5" />
                    <path d="M5 9.8V21h14V9.8" />
                  </svg>
                </Link>
              ) : null}
              <Link
                to="/settings/operations"
                title="Settings"
                aria-label="Settings"
                className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 p-2.5 text-indigo-100"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z" />
                  <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5h.1a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1V15Z" />
                </svg>
              </Link>
              {showGlobalExportButtons ? (
                <>
                  <button
                    type="button"
                    title={isPdfExporting ? 'Generating PDF report…' : 'Export PDF Report'}
                    aria-label="Export PDF Report"
                    disabled={isPdfExporting}
                    className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 p-2.5 text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      const aiEnabled = localStorage.getItem('nightwatch:ai-summary-enabled') === 'true';
                      setExportError(null);
                      setIsPdfExporting(true);
                      nightWatchClient.downloadPdfReport(undefined, aiEnabled)
                        .catch((err: unknown) => {
                          console.error('PDF export failed', err);
                          setExportError(err instanceof Error ? err.message : 'PDF export failed. Please try again.');
                        })
                        .finally(() => setIsPdfExporting(false));
                    }}
                  >
                    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${isPdfExporting ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
                      <path d="M14 2v5h5" />
                      <path d="M8 13h3" />
                      <path d="M8 17h2" />
                      <path d="M13 13h3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title={isHtmlExporting ? 'Generating HTML report…' : 'Export Interactive HTML Report'}
                    aria-label="Export HTML Report"
                    disabled={isHtmlExporting}
                    className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 p-2.5 text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      const aiEnabled = localStorage.getItem('nightwatch:ai-summary-enabled') === 'true';
                      setExportError(null);
                      setIsHtmlExporting(true);
                      nightWatchClient.downloadHtmlReport(undefined, aiEnabled)
                        .catch((err: unknown) => {
                          console.error('HTML export failed', err);
                          setExportError(err instanceof Error ? err.message : 'HTML export failed. Please try again.');
                        })
                        .finally(() => setIsHtmlExporting(false));
                    }}
                  >
                    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${isHtmlExporting ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 6h16" />
                      <path d="m8 10-4 4 4 4" />
                      <path d="m16 10 4 4-4 4" />
                      <path d="m13 6-2 12" />
                    </svg>
                  </button>
                </>
              ) : null}
              <button
                type="button"
                title="Hard Refresh — clears all cache"
                aria-label="Hard Refresh"
                className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 p-2.5 text-cyan-100 disabled:opacity-50"
                onClick={handleHardRefresh}
                disabled={isRefreshing}
              >
                <svg viewBox="0 0 24 24" className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
              <ThemeToggle isDark={isDark} onToggle={() => setIsDark((value) => !value)} />
            </div>
          </div>
        </header>

        {isSwitchingTenant && (
          <div className="mx-auto mb-4 flex w-full max-w-[1800px] items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
            <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
            </svg>
            <span>Loading data for <span className="font-semibold">{activeTenantName}</span>…</span>
          </div>
        )}
        {exportError ? (
          <div className="mx-auto mb-4 flex w-full max-w-[1800px] items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            <span className="flex-1">{exportError}</span>
            <button type="button" onClick={() => setExportError(null)} className="ml-auto shrink-0 text-red-300 hover:text-red-100" aria-label="Dismiss">✕</button>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1800px]">
          <RouteErrorBoundary>
          <Suspense
            fallback={(
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-200">
                Loading dashboard module...
              </div>
            )}
          >
            <Routes>
            <Route path="/" element={<ExecutiveDashboardPage refreshTick={refreshTick} />} />
            <Route path="/security" element={<SecurityDashboardPage refreshTick={refreshTick} />} />
            <Route path="/performance" element={<PerformanceDashboardPage refreshTick={refreshTick} />} />
            <Route path="/cost" element={<CostDashboardPage refreshTick={refreshTick} />} />
            <Route path="/capacity-planning" element={<CapacityPlanningDashboardPage refreshTick={refreshTick} />} />
            <Route path="/governance" element={<GovernanceDashboardPage refreshTick={refreshTick} />} />
            <Route path="/intelligence" element={<IntelligenceDashboardPage refreshTick={refreshTick} />} />
            <Route path="/msp" element={<MspDashboardPage refreshTick={refreshTick} />} />
            <Route path="/executive-cost-roi" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="executive-cost-roi" />} />
            <Route path="/cost-allocation" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="cost-allocation" />} />
            <Route path="/wastage-tracker" element={<WastageTrackerPage refreshTick={refreshTick} />} />
            <Route path="/ri-savings" element={<RiSavingsPage refreshTick={refreshTick} />} />
            <Route path="/true-bu-shared-cost" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="true-bu-shared-cost" />} />
            <Route path="/inactive-user-license-mapping" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="inactive-user-license-mapping" />} />
            <Route path="/lookback-seasonality-forecast" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="lookback-seasonality-forecast" />} />
            <Route path="/nonprod-uptime-leakage" element={<NonProdUptimePage refreshTick={refreshTick} />} />
            <Route path="/aks-micro-billing" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="aks-micro-billing" />} />
            <Route path="/azure-unified-cost-security" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="azure-unified-cost-security" />} />
            <Route path="/executive-summary-slides" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="executive-summary-slides" />} />
<Route path="/orphaned-resources" element={<OrphanedResourcesPage refreshTick={refreshTick} />} />
            <Route path="/overprivileged-identities" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="overprivileged-identities" />} />
            <Route path="/tag-hygiene-compliance" element={<TagHygienePage refreshTick={refreshTick} />} />
            <Route path="/spend-anomaly" element={<CostAnomalyForecastDashboardPage refreshTick={refreshTick} />} />
            <Route path="/iam-review" element={<OperationalForecastDashboardPage refreshTick={refreshTick} dashboardKey="iam-review" moduleLabel="IAM Risk Posture & Privilege Forecast" />} />
            <Route path="/network-perimeter" element={<NetworkPerimeterPage refreshTick={refreshTick} />} />
            <Route path="/backup-health" element={<OperationalForecastDashboardPage refreshTick={refreshTick} dashboardKey="backup-health" moduleLabel="Backup Reliability & Recovery Forecast" />} />
            <Route path="/threat-map" element={<OperationalForecastDashboardPage refreshTick={refreshTick} dashboardKey="threat-map" moduleLabel="Threat Escalation & Vulnerability Forecast" />} />
            <Route path="/compute-scaling" element={<OperationalForecastDashboardPage refreshTick={refreshTick} dashboardKey="compute-scaling" moduleLabel="Compute Scaling & Saturation Forecast" />} />
            <Route path="/hubspoke-expressroute" element={<Navigate to="/expressroute" replace />} />
            <Route path="/expressroute" element={<ExpressRoutePage />} />
            <Route path="/storage-iops" element={<OperationalForecastDashboardPage refreshTick={refreshTick} dashboardKey="storage-iops" moduleLabel="Storage IOPS Pressure & Growth Forecast" />} />
            <Route path="/aks-operations" element={<OperationalForecastDashboardPage refreshTick={refreshTick} dashboardKey="aks-operations" moduleLabel="AKS Operations Health & Capacity Forecast" />} />
            <Route path="/sql-managed-instance" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="sql-managed-instance" />} />
            <Route path="/cosmos-performance" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="cosmos-performance" />} />
            <Route path="/data-pipelines" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="data-pipelines" />} />
            <Route path="/app-service-health" element={<AppFunctionsHealthPage refreshTick={refreshTick} />} />
            <Route path="/app-functions-health" element={<Navigate to="/app-service-health" replace />} />
            <Route path="/policy-radar" element={<PolicyRadarPage refreshTick={refreshTick} />} />
            <Route path="/apim-operations" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="apim-operations" />} />
            <Route path="/microservices-map" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="microservices-map" />} />
            <Route path="/resource-deep-dive" element={<ResourceDeepDivePage refreshTick={refreshTick} />} />
            <Route path="/settings/operations" element={<OperationsConfigPage onScopeUpdated={() => setRefreshTick((value) => value + 1)} />} />
            <Route path="/network-topology" element={<NetworkTopologyPage refreshTick={refreshTick} />} />
            <Route path="/dr-recoverability" element={<DisasterRecoverabilityDashboardPage refreshTick={refreshTick} />} />
            <Route path="/quick-wins" element={<QuickWinsPage refreshTick={refreshTick} />} />
            <Route path="/top-costly-resources" element={<TopCostlyResourcesPage refreshTick={refreshTick} />} />
            <Route path="/subscription-cost" element={<SubscriptionCostPage refreshTick={refreshTick} />} />
            <Route path="/azure-changes" element={<AzureChangesPage refreshTick={refreshTick} />} />
            <Route path="/incident" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="executive-cost-roi" />} />
            <Route path="/identity" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="iam-review" />} />
            <Route path="/backup-dr" element={<DisasterRecoverabilityDashboardPage refreshTick={refreshTick} />} />
            <Route path="/slo-ux" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="app-functions-health" />} />
            <Route path="/change-reliability" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="compute-scaling" />} />
            <Route path="/capacity" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="compute-scaling" />} />
            <Route path="/data-health" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="sql-managed-instance" />} />
            <Route path="/network-assurance" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="network-perimeter" />} />
            <Route path="/compliance-audit" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="compliance-scorecard" />} />
            <Route path="/finops" element={<StrategicDashboardPage refreshTick={refreshTick} dashboardKey="executive-cost-roi" />} />
            <Route path="/database-health" element={<DatabaseHealthPage refreshTick={refreshTick} />} />
            <Route path="/key-vault-health" element={<KeyVaultHealthPage refreshTick={refreshTick} />} />
            <Route path="/aks-container-health" element={<AksContainerHealthPage refreshTick={refreshTick} />} />
            <Route path="/storage-compliance" element={<StorageCompliancePage refreshTick={refreshTick} />} />
            <Route path="/service-health" element={<ServiceHealthPage refreshTick={refreshTick} />} />
            <Route path="/managed-identity-audit" element={<ManagedIdentityAuditPage refreshTick={refreshTick} />} />
            <Route path="/advisor-score" element={<AdvisorScorePage refreshTick={refreshTick} />} />
            <Route path="/messaging-health" element={<MessagingHealthPage refreshTick={refreshTick} />} />
            <Route path="/support-tickets" element={<SupportTicketPage refreshTick={refreshTick} />} />
            <Route path="/vmss-health" element={<VmssHealthPage refreshTick={refreshTick} />} />
            <Route path="/alerts" element={<AlertsDashboardPage refreshTick={refreshTick} />} />
            <Route path="/vwan" element={<VwanPage />} />
            <Route path="/azure-firewall" element={<AzureFirewallPage />} />
            <Route path="/app-gateway" element={<AppGatewayPage />} />
            <Route path="/vpn-gateway" element={<VpnGatewayPage />} />
            <Route path="/identity-attack-surface" element={<IdentityAttackSurfacePage refreshTick={refreshTick} />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/alerts-digest" element={<AlertsDigestPage />} />
            <Route path="/alert-thresholds" element={<AlertThresholdsPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/monthly-review" element={<MonthlyReviewPage refreshTick={refreshTick} />} />
            <Route path="/report-history" element={<ReportHistoryPage />} />
            <Route path="/report-schedule" element={<ReportSchedulePage />} />
            <Route path="/score-history" element={<ScoreHistoryPage refreshTick={refreshTick} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </RouteErrorBoundary>
        </main>

        <footer className="mx-auto mt-6 w-full max-w-[1800px] flex justify-end px-1">
          <span className="select-none rounded-md border border-white/10 bg-slate-900/50 px-2.5 py-1 font-mono text-[10px] text-slate-500">
            v{__APP_VERSION__} · build {__GIT_COMMIT__}
          </span>
        </footer>
      </div>
  );
}

function UnauthorizedPage() {
  const { instance, accounts } = useMsal();
  const isSignedIn = accounts.length > 0;

  const handleSignOut = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-8 text-center shadow-2xl">
        <img src="/nightwatch-icon.svg" alt="NightWatch" className="mx-auto mb-6 h-16 w-16 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20">
          <svg className="h-8 w-8 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-white">Access Restricted</h1>
        <p className="mt-3 text-sm text-slate-300">
          Azure Night Watch is an internal platform for MSP operators only.
          {isSignedIn
            ? ' Your account does not have permission to access this application.'
            : ' You must sign in with an authorised MSP account to continue.'}
        </p>
        {isSignedIn ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => instance.loginRedirect({ scopes: getApiScopes() })}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.5 0H0v11.5h11.5V0z" fill="#f25022"/>
              <path d="M24 0H12.5v11.5H24V0z" fill="#7fba00"/>
              <path d="M11.5 12.5H0V24h11.5V12.5z" fill="#00a4ef"/>
              <path d="M24 12.5H12.5V24H24V12.5z" fill="#ffb900"/>
            </svg>
            Sign in with Microsoft
          </button>
        )}
        <p className="mt-4 text-xs text-slate-600">If you believe this is an error, contact your NightWatch administrator.</p>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress, instance } = useMsal();
  // null = still verifying with backend, true = MSP user, false = blocked
  const [mspVerified, setMspVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isMsalEnabled()) { setMspVerified(true); return; }
    if (inProgress !== InteractionStatus.None) return;
    if (!isAuthenticated) { setMspVerified(false); return; }

    // Ask the backend — its JWT validation is the definitive check.
    // Only tokens issued by the MSP tenant / accepted audience pass [Authorize].
    const account = instance.getActiveAccount();
    const scopes = getApiScopes();
    (async () => {
      try {
        const tokenResponse = await instance.acquireTokenSilent({ scopes, account: account ?? undefined });
        const res = await fetch(`${getApiBaseUrl()}/api/auth/check`, {
          headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
        });
        setMspVerified(res.ok);
      } catch {
        setMspVerified(false);
      }
    })();
  }, [isAuthenticated, inProgress, instance]);

  if (!isMsalEnabled()) return <>{children}</>;

  if (inProgress !== InteractionStatus.None || mspVerified === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || mspVerified === false) return <UnauthorizedPage />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tenants/consent-callback" element={<ConsentCallbackPage />} />
        <Route path="*" element={
          <AuthGuard>
            <TenantProvider>
              <AppShell />
            </TenantProvider>
          </AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
