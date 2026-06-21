import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { AlertItem, AlertsDashboard } from '../types/dashboard';

interface AlertsDashboardPageProps { refreshTick: number; }

const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 };

const SEV_META: Record<string, { label: string; color: string; accent: string; bar: string }> = {
  Sev0: { label: 'Critical', color: 'text-red-400',    accent: 'border-red-400/30 bg-red-500/10',    bar: '#ef4444' },
  Sev1: { label: 'Error',    color: 'text-orange-400', accent: 'border-orange-400/30 bg-orange-500/10', bar: '#f97316' },
  Sev2: { label: 'Warning',  color: 'text-amber-400',  accent: 'border-amber-400/30 bg-amber-500/10',  bar: '#f59e0b' },
  Sev3: { label: 'Info',     color: 'text-cyan-400',   accent: 'border-cyan-400/30 bg-cyan-500/10',   bar: '#06b6d4' },
  Sev4: { label: 'Verbose',  color: 'text-slate-400',  accent: 'border-slate-600/40 bg-slate-700/20',  bar: '#64748b' },
};

function sevMeta(sev: string) {
  return SEV_META[sev] ?? { label: sev, color: 'text-slate-300', accent: 'border-slate-700/40 bg-slate-800/30', bar: '#64748b' };
}

function stateBadge(state: string) {
  const s = state.toLowerCase();
  if (s === 'new') return 'bg-rose-500/20 text-rose-300';
  if (s === 'acknowledged') return 'bg-amber-500/20 text-amber-300';
  return 'bg-slate-700/50 text-slate-400';
}

function conditionBadge(cond: string) {
  return cond.toLowerCase() === 'fired'
    ? 'bg-red-500/10 text-red-400'
    : 'bg-emerald-500/10 text-emerald-400';
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const meta = sevMeta(alert.severity);
  const resourceShort = alert.targetResource.split('/').pop() || alert.targetResource;
  const typeShort = alert.targetResourceType.split('/').pop() || alert.targetResourceType;
  return (
    <tr className="border-b border-white/5 transition hover:bg-slate-800/30">
      <td className="px-3 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${meta.accent} ${meta.color}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-2.5 max-w-[200px]">
        <p className="truncate text-sm font-medium text-white" title={alert.name}>{alert.name}</p>
        <p className="truncate text-xs text-slate-400" title={alert.targetResource}>{resourceShort} · {typeShort}</p>
      </td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadge(alert.alertState)}`}>
          {alert.alertState}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conditionBadge(alert.monitorCondition)}`}>
          {alert.monitorCondition}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-400">{alert.monitorService}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400 hidden sm:table-cell">{alert.subscriptionName}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap hidden md:table-cell">
        {new Date(alert.firedDateTime).toLocaleString()}
      </td>
    </tr>
  );
}

export function AlertsDashboardPage({ refreshTick }: AlertsDashboardPageProps) {
  const [data, setData] = useState<AlertsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getAlertsDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const sevKpis = [
    { key: 'Sev0', label: 'Critical', value: data.sev0Count },
    { key: 'Sev1', label: 'Error',    value: data.sev1Count },
    { key: 'Sev2', label: 'Warning',  value: data.sev2Count },
    { key: 'Sev3', label: 'Info',     value: data.sev3Count },
    { key: 'Sev4', label: 'Verbose',  value: data.sev4Count },
  ];

  const serviceChartData = data.byService.slice(0, 10).map((s) => ({
    name: s.serviceName.length > 18 ? s.serviceName.slice(0, 18) + '…' : s.serviceName,
    count: s.count,
  }));

  const filtered = data.alerts.filter((a) => {
    if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
    if (stateFilter !== 'all' && a.alertState.toLowerCase() !== stateFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Azure Monitor Alerts</h2>
        <p className="mt-2 text-sm text-slate-300">
          Active alert instances across all subscriptions
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalActive} open · {data.newCount} new · {data.acknowledgedCount} acknowledged
        </p>
      </section>

      {/* Severity KPI tiles — direct in flow */}
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        {sevKpis.map((k) => {
          const meta = sevMeta(k.key);
          const active = sevFilter === k.key;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => setSevFilter(active ? 'all' : k.key)}
              className={`rounded-2xl border p-5 text-center transition ${
                active ? `${meta.accent} ring-1 ring-current ${meta.color}` : 'border-slate-700/40 bg-slate-800/30 hover:border-slate-600'
              }`}
            >
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{k.label}</p>
              <p className={`mt-3 text-4xl font-black ${meta.color}`}>{k.value}</p>
              <p className="mt-1 text-xs text-slate-500">alerts</p>
            </button>
          );
        })}
      </div>

      {/* State summary + service chart */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Alert Analysis</h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs text-slate-400">Alert State Breakdown</p>
            {data.totalActive === 0 ? (
              <div className="py-8 text-center">
                <p className="text-3xl">✅</p>
                <p className="mt-2 text-sm font-semibold text-emerald-400">No Active Alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'New', value: data.newCount, color: 'bg-rose-500', text: 'text-rose-300' },
                  { label: 'Acknowledged', value: data.acknowledgedCount, color: 'bg-amber-500', text: 'text-amber-300' },
                ].map((s) => {
                  const pct = data.totalActive > 0 ? Math.round((s.value / data.totalActive) * 100) : 0;
                  return (
                    <div key={s.label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className={s.text}>{s.label}</span>
                        <span className="text-slate-400">{s.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-700/60">
                        <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {serviceChartData.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-slate-400">Alerts by Monitor Service (top 10)</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={110} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {serviceChartData.map((_, i) => (
                        <Cell key={i} fill={['#ef4444', '#f97316', '#f59e0b', '#06b6d4', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'][i % 10]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Alert table */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Active Alerts ({filtered.length}{filtered.length !== data.alerts.length ? ` of ${data.alerts.length}` : ''})
          </h3>
          <div className="flex gap-2">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All States</option>
              <option value="new">New</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
            <select
              value={sevFilter}
              onChange={(e) => setSevFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="Sev0">Critical (Sev0)</option>
              <option value="Sev1">Error (Sev1)</option>
              <option value="Sev2">Warning (Sev2)</option>
              <option value="Sev3">Info (Sev3)</option>
              <option value="Sev4">Verbose (Sev4)</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl">✅</p>
            <p className="mt-2 text-sm font-semibold text-emerald-400">No alerts match the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Alert / Resource</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Condition</th>
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Subscription</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Fired</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <AlertRow key={a.alertId} alert={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
