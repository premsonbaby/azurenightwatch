import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { NonProdUptimeDashboard } from '../types/dashboard';

interface NonProdUptimePageProps {
  refreshTick: number;
}

const fmt = (v: number) =>
  `€${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ENV_COLORS: Record<string, string> = {
  dev: '#06b6d4',
  development: '#06b6d4',
  test: '#8b5cf6',
  uat: '#f59e0b',
  staging: '#f59e0b',
  qa: '#f97316',
  demo: '#ec4899',
};

function envColor(env: string) {
  return ENV_COLORS[env.toLowerCase()] ?? '#64748b';
}

export function NonProdUptimePage({ refreshTick }: NonProdUptimePageProps) {
  const [data, setData] = useState<NonProdUptimeDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getNonProdUptimeDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;
  return <NonProdUptimeContent data={data} />;
}

function NonProdUptimeContent({ data }: { data: NonProdUptimeDashboard }) {
  const [search, setSearch] = useState('');

  const byEnvironment = useMemo(() => {
    const map: Record<string, { count: number; cost: number }> = {};
    for (const vm of data.runningVms) {
      const env = vm.environment || 'Unknown';
      if (!map[env]) map[env] = { count: 0, cost: 0 };
      map[env].count++;
      map[env].cost += vm.estimatedMonthlyCostEur;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, count: v.count, cost: Math.round(v.cost * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost);
  }, [data.runningVms]);

  const filtered = useMemo(
    () => data.runningVms.filter((v) =>
      !search.trim() ||
      v.resourceName.toLowerCase().includes(search.toLowerCase()) ||
      v.subscriptionName.toLowerCase().includes(search.toLowerCase()) ||
      v.environment.toLowerCase().includes(search.toLowerCase()),
    ),
    [data.runningVms, search],
  );

  const stoppedCount = data.nonProdVmCount - data.runningNonProdVmCount;
  const hasRunning = data.runningNonProdVmCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Non-Prod Uptime Leakage</h2>
        <p className="mt-2 text-sm text-slate-300">
          Development, test, UAT, and staging VMs that are running outside business hours accumulate cost with no active workload benefit.
          These are candidates for automatic shutdown schedules.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          Source: Azure Resource Graph · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Total Non-Prod VMs</p>
          <p className="mt-3 text-4xl font-black text-slate-200">{data.nonProdVmCount}</p>
          <p className="mt-1 text-xs text-slate-500">detected in estate</p>
        </div>
        <div className={`rounded-2xl border p-5 text-center ${hasRunning ? 'border-rose-400/25 bg-rose-500/8' : 'border-emerald-400/20 bg-emerald-500/6'}`}>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Currently Running</p>
          <p className={`mt-3 text-4xl font-black ${hasRunning ? 'text-rose-300' : 'text-emerald-300'}`}>{data.runningNonProdVmCount}</p>
          <p className="mt-1 text-xs text-slate-500">non-prod VMs on now</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/6 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Stopped / Deallocated</p>
          <p className="mt-3 text-4xl font-black text-emerald-300">{stoppedCount}</p>
          <p className="mt-1 text-xs text-slate-500">not accruing compute</p>
        </div>
        <div className={`rounded-2xl border p-5 text-center ${hasRunning ? 'border-amber-400/25 bg-amber-500/8' : 'border-slate-700/40 bg-slate-800/30'}`}>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Monthly Leakage</p>
          <p className={`mt-3 text-4xl font-black ${hasRunning ? 'text-amber-300' : 'text-slate-500'}`}>
            {fmt(data.estimatedMonthlyLeakageEur)}
          </p>
          <p className="mt-1 text-xs text-slate-500">if running all month</p>
        </div>
      </div>

      {/* No running VMs state */}
      {!hasRunning && (
        <section className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-8 text-center">
          <p className="text-2xl">✓</p>
          <p className="mt-3 text-base font-semibold text-slate-200">No non-prod VMs are currently running</p>
          <p className="mt-2 max-w-xl mx-auto text-sm text-slate-400">
            All detected non-prod VMs are stopped or deallocated. No uptime leakage at this moment.
            Check back during business hours or after deployments to catch VMs left running.
          </p>
        </section>
      )}

      {/* Charts */}
      {hasRunning && byEnvironment.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Running VMs by Environment</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byEnvironment} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                    formatter={(v) => [fmt(Number(v)), 'Monthly Cost']}
                  />
                  <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                    {byEnvironment.map((e) => (
                      <Cell key={e.name} fill={envColor(e.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Environment Summary</h3>
            <div className="space-y-3 mt-4">
              {byEnvironment.map((e) => (
                <div key={e.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: envColor(e.name) }} />
                    <span className="capitalize text-slate-300">{e.name}</span>
                    <span className="text-slate-500">({e.count} VM{e.count !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="font-semibold text-amber-300">{fmt(e.cost)}/mo</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Running VMs table */}
      {hasRunning && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
              Running Non-Prod VMs ({filtered.length})
            </h3>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, subscription, environment..."
              className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400/50 focus:outline-none"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No results match your filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                    <th className="px-3 py-2">VM Name</th>
                    <th className="px-3 py-2">Environment</th>
                    <th className="px-3 py-2">Subscription</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2 text-right">Monthly Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((vm) => (
                    <tr key={vm.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                      <td className="px-3 py-2.5 font-medium text-slate-100">{vm.resourceName}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                          style={{ background: envColor(vm.environment) + '22', color: envColor(vm.environment) }}
                        >
                          {vm.environment}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{vm.subscriptionName}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{vm.vmSize}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-300">{fmt(vm.estimatedMonthlyCostEur)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={4} className="px-3 py-2 text-xs text-slate-400">Total monthly leakage</td>
                    <td className="px-3 py-2 text-right font-bold text-amber-200">{fmt(data.estimatedMonthlyLeakageEur)}/mo</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Cost estimate based on VM size pricing for the deployment region. Actual saving depends on shutdown schedule and usage patterns.
          </p>
        </section>
      )}
    </div>
  );
}
