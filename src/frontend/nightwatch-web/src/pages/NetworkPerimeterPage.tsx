import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { NetworkPerimeterDashboard, ExposedResource } from '../types/dashboard';

interface NetworkPerimeterPageProps {
  refreshTick: number;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#10b981',
};

function riskColor(level: string) {
  return RISK_COLORS[level.toLowerCase()] ?? '#64748b';
}

export function NetworkPerimeterPage({ refreshTick }: NetworkPerimeterPageProps) {
  const [data, setData] = useState<NetworkPerimeterDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);

    nightWatchClient.getNetworkPerimeterDashboard(refreshTick)
      .then((response) => { if (isMounted) { setData(response); setIsLoading(false); } })
      .catch((error) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load network perimeter data.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  return <NetworkPerimeterContent data={data} />;
}

function RiskBadge({ level }: { level: string }) {
  const color = riskColor(level);
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
      style={{ background: color + '22', color }}
    >
      {level}
    </span>
  );
}

function ExposureTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    'open management port': '#f97316',
    'dangerous nsg rule':   '#ef4444',
    'unprotected public ip': '#f59e0b',
    'no nsg':               '#a855f7',
  };
  const color = colorMap[type.toLowerCase()] ?? '#64748b';
  return (
    <span
      className="rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ background: color + '18', color }}
    >
      {type}
    </span>
  );
}

function KpiCard({
  label, value, sub, colorClass, borderClass,
}: {
  label: string;
  value: number | string;
  sub?: string;
  colorClass: string;
  borderClass: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 text-center ${borderClass}`}>
      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-black ${colorClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function groupByExposureType(resources: ExposedResource[]) {
  const counts: Record<string, number> = {};
  for (const r of resources) {
    counts[r.exposureType] = (counts[r.exposureType] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function NetworkPerimeterContent({ data }: { data: NetworkPerimeterDashboard }) {
  const hasExposed = data.exposedResources.length > 0;
  const criticalCount = data.exposedResources.filter((r) => r.riskLevel.toLowerCase() === 'critical').length;
  const highCount = data.exposedResources.filter((r) => r.riskLevel.toLowerCase() === 'high').length;
  const exposureGroups = groupByExposureType(data.exposedResources);

  const headerBorderColor = data.dangerousNsgRuleCount > 0 || criticalCount > 0
    ? 'border-red-400/25'
    : data.openManagementPortResources > 0
    ? 'border-orange-400/25'
    : 'border-white/10';

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className={`rounded-3xl border ${headerBorderColor} bg-slate-900/75 p-6 shadow-2xl`}>
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Network Perimeter</h2>
        <p className="mt-2 text-sm text-slate-300">
          Public exposure, open management ports, and NSG rule risks across all subscriptions.
          Identify unprotected resources before they become an attack surface.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          Source: Azure Resource Graph · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Public IPs"
          value={data.totalPublicIps}
          sub="across all subscriptions"
          colorClass={data.totalPublicIps > 0 ? 'text-sky-300' : 'text-slate-500'}
          borderClass={data.totalPublicIps > 0 ? 'border-sky-400/25 bg-sky-500/8' : 'border-slate-700/40 bg-slate-800/30'}
        />
        <KpiCard
          label="Unprotected Public IPs"
          value={data.unprotectedPublicIps}
          sub="no NSG or firewall"
          colorClass={data.unprotectedPublicIps > 0 ? 'text-amber-300' : 'text-emerald-400'}
          borderClass={data.unprotectedPublicIps > 0 ? 'border-amber-400/25 bg-amber-500/8' : 'border-emerald-400/20 bg-emerald-500/5'}
        />
        <KpiCard
          label="Open Mgmt Ports"
          value={data.openManagementPortResources}
          sub="RDP / SSH exposed"
          colorClass={data.openManagementPortResources > 0 ? 'text-orange-300' : 'text-emerald-400'}
          borderClass={data.openManagementPortResources > 0 ? 'border-orange-400/25 bg-orange-500/8' : 'border-emerald-400/20 bg-emerald-500/5'}
        />
        <KpiCard
          label="Dangerous NSG Rules"
          value={data.dangerousNsgRuleCount}
          sub="allow-any inbound"
          colorClass={data.dangerousNsgRuleCount > 0 ? 'text-red-300' : 'text-emerald-400'}
          borderClass={data.dangerousNsgRuleCount > 0 ? 'border-red-400/25 bg-red-500/8' : 'border-emerald-400/20 bg-emerald-500/5'}
        />
      </div>

      {/* Summary chips */}
      {hasExposed && (criticalCount > 0 || highCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-sm font-semibold text-red-200">{criticalCount} Critical exposure{criticalCount > 1 ? 's' : ''}</span>
            </div>
          )}
          {highCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              <span className="text-sm font-semibold text-orange-200">{highCount} High risk resource{highCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Clean state */}
      {!hasExposed && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-8 text-center">
          <p className="text-2xl">✓</p>
          <p className="mt-3 text-base font-semibold text-emerald-200">No exposed resources detected</p>
          <p className="mt-2 text-sm text-slate-400">
            Your network perimeter looks clean. All public IPs appear protected and no dangerous NSG rules were found.
          </p>
        </section>
      )}

      {/* Exposure breakdown */}
      {hasExposed && exposureGroups.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Exposure Breakdown
          </h3>
          <div className="flex flex-wrap gap-3">
            {exposureGroups.map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2.5">
                <ExposureTypeBadge type={type} />
                <span className="text-sm font-bold text-slate-100">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Exposed resources table */}
      {hasExposed && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Exposed Resources ({data.exposedResources.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2">NSG / Rule</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Subscription</th>
                  <th className="px-3 py-2">Exposure</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.exposedResources.map((r, i) => {
                  const [nsgPart, rulePart] = r.resourceName.includes('  /  ')
                    ? r.resourceName.split('  /  ')
                    : [r.resourceName, null];
                  return (
                    <tr key={i} className="border-b border-white/5 transition hover:bg-slate-800/30">
                      <td className="px-3 py-3">
                        <span className="block font-semibold text-slate-100">{nsgPart.trim()}</span>
                        {rulePart && <span className="block font-mono text-xs text-slate-400 mt-0.5">{rulePart.trim()}</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-400 text-xs">{r.resourceType}</td>
                      <td className="px-3 py-3 text-slate-400 text-xs">{r.subscriptionName}</td>
                      <td className="px-3 py-3"><ExposureTypeBadge type={r.exposureType} /></td>
                      <td className="px-3 py-3 text-xs text-slate-400">{r.details ?? '—'}</td>
                      <td className="px-3 py-3"><RiskBadge level={r.riskLevel} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
