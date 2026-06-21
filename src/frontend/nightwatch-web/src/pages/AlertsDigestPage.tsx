import { useEffect, useState, useMemo } from 'react';
import { nightWatchClient } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import type { AlertDigest, AlertBreach } from '../types/dashboard';
import type { CustomerTenant } from '../types/tenant';

const SEVERITY_STYLES: Record<string, string> = {
  Critical: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  High: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Medium: 'bg-white/20 text-[#888888] border-white/30',
  Low: 'bg-zinc-500/20 text-zinc-400 border-zinc-600/30',
};

const METRIC_LABELS: Record<string, string> = {
  MonthlyCostCeiling: 'Monthly Cost Ceiling',
  MonthlyCostRunRate: 'Cost Run Rate',
  SecurityScoreFloor: 'Security Score',
  AdvisorScoreFloor: 'Advisor Score',
  BackupCoverageFloor: 'Backup Coverage',
  GovernanceScoreFloor: 'Governance Score',
  ReliabilityScoreFloor: 'Reliability Score',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.Low}`}>
      {severity}
    </span>
  );
}

function BreachCard({ breach, tenantName, onAcknowledged }: { breach: AlertBreach; tenantName: string; onAcknowledged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [acking, setAcking] = useState(false);

  async function acknowledge() {
    setAcking(true);
    try {
      await nightWatchClient.acknowledgeThresholdBreach(breach.tenantId, breach.id);
      onAcknowledged();
    } finally {
      setAcking(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-500 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <SeverityBadge severity={breach.severity} />
            <span className="text-xs font-medium text-zinc-300 bg-zinc-500 rounded px-2 py-0.5">
              {METRIC_LABELS[breach.metricType] ?? breach.metricType}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-medium text-[#e0e0e0]">
              {tenantName}
            </span>
            <span className="text-xs text-zinc-400">{timeAgo(breach.breachedAt)}</span>
          </div>
          <p className="text-sm font-semibold text-white">
            {breach.alertTitle ?? `${METRIC_LABELS[breach.metricType] ?? breach.metricType} alert`}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Actual: <span className="text-zinc-300 font-medium">{breach.actualValue.toFixed(1)}</span>
            {' · '}Threshold: <span className="text-zinc-300 font-medium">{breach.thresholdValue.toFixed(1)}</span>
          </p>
          {(breach.businessImpact || breach.suggestedAction) && (
            <button type="button" onClick={() => setExpanded(v => !v)}
              className="mt-1.5 text-xs text-zinc-400 hover:text-zinc-300">
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {breach.businessImpact && (
                <p className="text-xs text-zinc-300"><span className="text-zinc-500">Impact: </span>{breach.businessImpact}</p>
              )}
              {breach.suggestedAction && (
                <p className="text-xs text-zinc-300"><span className="text-zinc-500">Action: </span>{breach.suggestedAction}</p>
              )}
            </div>
          )}
          {breach.isAcknowledged && breach.acknowledgedBy && (
            <p className="mt-1.5 text-xs text-zinc-500">Acknowledged by {breach.acknowledgedBy}</p>
          )}
        </div>
        {!breach.isAcknowledged && (
          <button type="button" disabled={acking} onClick={acknowledge}
            className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
            {acking ? '…' : 'Acknowledge'}
          </button>
        )}
      </div>
    </div>
  );
}

export function AlertsDigestPage() {
  const [digest, setDigest] = useState<AlertDigest | null>(null);
  const [customerTenants, setCustomerTenants] = useState<CustomerTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'All' | 'Critical' | 'High' | 'Medium'>('All');
  const [tenantFilter, setTenantFilter] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      nightWatchClient.getAlertDigest(),
      nightWatchClient.getCustomerTenants().catch(() => [] as CustomerTenant[]),
    ]).then(([d, t]) => {
      setDigest(d);
      setCustomerTenants(t);
    }).catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const tenantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    customerTenants.forEach(t => map.set(t.tenantId, t.displayName));
    return map;
  }, [customerTenants]);

  const tenants = useMemo(() => {
    const seen = new Set<string>();
    digest?.breaches.forEach(b => seen.add(b.tenantId));
    return Array.from(seen)
      .map(id => ({ id, name: tenantNameMap.get(id) ?? (id === 'global' ? 'Home Tenant' : id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [digest, tenantNameMap]);

  const breaches = useMemo(() => (digest?.breaches ?? []).filter(b => {
    const matchesSeverity = severityFilter === 'All' || b.severity === severityFilter;
    const matchesTenant = !tenantFilter || b.tenantId === tenantFilter;
    return matchesSeverity && matchesTenant;
  }), [digest, severityFilter, tenantFilter]);

  const header = (
    <div className="rounded-3xl border border-white/10 bg-zinc-500 p-6 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PageBackButton />
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#c0c0c0]">Alerts</p>
          <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white">Alert Digest</h2>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">Loading alerts…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-3xl border border-white/10 bg-zinc-500 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PageBackButton />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#c0c0c0]">Alerts</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#e0e0e0]">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Global MSP View — All Tenants
                </span>
              </div>
              <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white">Alert Digest</h2>
              <p className="mt-1 text-xs text-zinc-400">All open threshold breaches across every customer tenant, regardless of which tenant is currently selected.</p>
            </div>
          </div>
          <button type="button" onClick={load}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-500 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI cards */}
      {digest && (
        <div className="rounded-3xl border border-white/10 bg-zinc-500 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 mb-4">Open Breaches Summary</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-zinc-500 p-4 col-span-1">
              <p className="text-xs text-zinc-400">Total Open</p>
              <p className={`mt-1 text-3xl font-black ${digest.total === 0 ? 'text-emerald-400' : 'text-white'}`}>{digest.total}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${digest.critical > 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/10 bg-zinc-500'}`}>
              <p className="text-xs text-zinc-400">Critical</p>
              <p className={`mt-1 text-3xl font-black ${digest.critical > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{digest.critical}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${digest.high > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-zinc-500'}`}>
              <p className="text-xs text-zinc-400">High</p>
              <p className={`mt-1 text-3xl font-black ${digest.high > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{digest.high}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-500 p-4">
              <p className="text-xs text-zinc-400">Medium</p>
              <p className="mt-1 text-3xl font-black text-[#888888]">{digest.medium}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-500 p-4">
              <p className="text-xs text-zinc-400">Tenants Affected</p>
              <p className={`mt-1 text-3xl font-black ${digest.affectedTenants > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{digest.affectedTenants}</p>
            </div>
          </div>
        </div>
      )}

      {/* Breach list */}
      <div className="rounded-2xl border border-white/10 bg-zinc-500 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 mr-auto">All Open Breaches</p>

          {/* Tenant dropdown */}
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
            <select
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-zinc-500 py-1.5 pl-8 pr-7 text-xs text-zinc-100 focus:border-white/30 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">All Tenants ({tenants.length})</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>

          {/* Severity filter */}
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            {(['All', 'Critical', 'High', 'Medium'] as const).map(f => (
              <button key={f} type="button" onClick={() => setSeverityFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  severityFilter === f ? 'bg-[#c0c0c0] text-white' : 'bg-zinc-500 text-zinc-400 hover:bg-zinc-500'
                }`}>
                {f}
              </button>
            ))}
          </div>

          <span className="text-xs text-zinc-500">{breaches.length} of {digest?.total ?? 0}</span>
        </div>
        {breaches.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-400">
            {digest?.total === 0 ? 'No open breaches across any tenant.' : 'No breaches match this filter.'}
          </div>
        ) : (
          <div className="space-y-3">
            {breaches.map(b => (
              <BreachCard key={b.id} breach={b} tenantName={tenantNameMap.get(b.tenantId) ?? (b.tenantId === 'global' ? 'Home Tenant' : b.tenantId)} onAcknowledged={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
