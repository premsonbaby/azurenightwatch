import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { AppFunctionItem, AppFunctionsHealthDashboard } from '../types/dashboard';

interface AppFunctionsHealthPageProps {
  refreshTick: number;
}

const KIND_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  functionapp: { bg: 'bg-violet-500/15', text: 'text-violet-300', dot: '#8b5cf6' },
  'functionapp,linux': { bg: 'bg-violet-500/15', text: 'text-violet-300', dot: '#8b5cf6' },
  'functionapp,workflowapp': { bg: 'bg-indigo-500/15', text: 'text-indigo-300', dot: '#6366f1' },
  app: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', dot: '#06b6d4' },
  'app,linux': { bg: 'bg-cyan-500/15', text: 'text-cyan-300', dot: '#06b6d4' },
  workflowapp: { bg: 'bg-pink-500/15', text: 'text-pink-300', dot: '#ec4899' },
};

const PIE_FALLBACK = '#475569';

function kindLabel(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes('workflowapp')) return 'Logic App';
  if (k.includes('functionapp')) return 'Function App';
  if (k.startsWith('app')) return 'Web App';
  return kind;
}

function kindColors(kind: string) {
  return KIND_COLORS[kind.toLowerCase()] ?? { bg: 'bg-slate-700/30', text: 'text-slate-300', dot: PIE_FALLBACK };
}

function StateChip({ state }: { state: string }) {
  const isRunning = state.toLowerCase() === 'running';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isRunning ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {state}
    </span>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const { bg, text } = kindColors(kind);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${bg} ${text}`}>
      {kindLabel(kind)}
    </span>
  );
}

export function AppFunctionsHealthPage({ refreshTick }: AppFunctionsHealthPageProps) {
  const [data, setData] = useState<AppFunctionsHealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'Running' | 'Stopped'>('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'Web App' | 'Function App' | 'Logic App'>('all');

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);

    nightWatchClient.getAppFunctionsHealthDashboard(refreshTick)
      .then((response) => { if (isMounted) { setData(response); setIsLoading(false); } })
      .catch((error) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load App Service Health data.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  return <AppFunctionsContent data={data} search={search} setSearch={setSearch} stateFilter={stateFilter} setStateFilter={setStateFilter} kindFilter={kindFilter} setKindFilter={setKindFilter} />;
}

function AppFunctionsContent({
  data, search, setSearch, stateFilter, setStateFilter, kindFilter, setKindFilter,
}: {
  data: AppFunctionsHealthDashboard;
  search: string;
  setSearch: (v: string) => void;
  stateFilter: 'all' | 'Running' | 'Stopped';
  setStateFilter: (v: 'all' | 'Running' | 'Stopped') => void;
  kindFilter: 'all' | 'Web App' | 'Function App' | 'Logic App';
  setKindFilter: (v: 'all' | 'Web App' | 'Function App' | 'Logic App') => void;
}) {
  const runningPct = data.totalApps > 0 ? Math.round((data.runningApps / data.totalApps) * 100) : 0;

  const kindPieData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const app of data.apps) {
      const label = kindLabel(app.kind);
      buckets[label] = (buckets[label] ?? 0) + 1;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [data.apps]);

  const dotByLabel: Record<string, string> = {
    'Function App': KIND_COLORS.functionapp.dot,
    'Web App': KIND_COLORS.app.dot,
    'Logic App': KIND_COLORS.workflowapp.dot,
  };

  const filtered = useMemo(() => {
    return data.apps.filter((app) => {
      if (stateFilter !== 'all' && app.state.toLowerCase() !== stateFilter.toLowerCase()) return false;
      if (kindFilter !== 'all' && kindLabel(app.kind) !== kindFilter) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        if (!app.name.toLowerCase().includes(term) && !app.subscriptionName.toLowerCase().includes(term) && !app.location.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [data.apps, stateFilter, kindFilter, search]);

  const stoppedApps = data.apps.filter((a) => a.state.toLowerCase() !== 'running');

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">App Service Health</h2>
        <p className="mt-2 text-sm text-slate-300">
          Inventory and health status of App Services, Function Apps, and Logic Apps discovered across your Azure subscriptions.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalApps} total · {data.runningApps} running · {data.stoppedApps} stopped
          {data.functionAppCount > 0 && ` · ${data.functionAppCount} function apps`}
          {data.webAppCount > 0 && ` · ${data.webAppCount} web apps`}
          {data.logicAppCount > 0 && ` · ${data.logicAppCount} logic apps`}
        </p>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total Apps', value: data.totalApps, accent: 'border-cyan-400/25 bg-cyan-500/8', text: 'text-cyan-100' },
          { label: 'Running', value: data.runningApps, accent: 'border-emerald-400/25 bg-emerald-500/8', text: 'text-emerald-100' },
          { label: 'Stopped', value: data.stoppedApps, accent: data.stoppedApps > 0 ? 'border-amber-400/25 bg-amber-500/8' : 'border-slate-700/40 bg-slate-800/30', text: data.stoppedApps > 0 ? 'text-amber-100' : 'text-slate-400' },
          { label: 'Web Apps', value: data.webAppCount, accent: 'border-cyan-400/20 bg-slate-800/40', text: 'text-cyan-200' },
          { label: 'Function Apps', value: data.functionAppCount, accent: 'border-violet-400/20 bg-slate-800/40', text: 'text-violet-200' },
          { label: 'Logic Apps', value: data.logicAppCount, accent: 'border-pink-400/20 bg-slate-800/40', text: 'text-pink-200' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 ${stat.accent}`}>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{stat.label}</p>
            <p className={`mt-2 text-3xl font-black ${stat.text}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Health bar + type breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Running ratio */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Availability Ratio</h3>
          <div className="mt-4 flex items-end gap-3">
            <p className={`text-5xl font-black ${runningPct >= 90 ? 'text-emerald-300' : runningPct >= 70 ? 'text-amber-300' : 'text-rose-300'}`}>{runningPct}%</p>
            <p className="mb-1 text-sm text-slate-400">of apps currently running</p>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-700/60">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${runningPct >= 90 ? 'bg-emerald-400' : runningPct >= 70 ? 'bg-amber-400' : 'bg-rose-400'}`}
              style={{ width: `${runningPct}%` }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span><span className="font-semibold text-emerald-300">{data.runningApps}</span> Running</span>
            <span><span className={`font-semibold ${data.stoppedApps > 0 ? 'text-amber-300' : 'text-slate-400'}`}>{data.stoppedApps}</span> Stopped</span>
            <span><span className="font-semibold text-slate-300">{data.totalApps - data.runningApps - data.stoppedApps}</span> Other</span>
          </div>
        </section>

        {/* Kind distribution */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">App Type Distribution</h3>
          {kindPieData.length > 0 ? (
            <div className="mt-2 flex items-center gap-4">
              <div className="h-[120px] w-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={kindPieData} cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={2} dataKey="value">
                      {kindPieData.map((entry) => (
                        <Cell key={entry.name} fill={dotByLabel[entry.name] ?? PIE_FALLBACK} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                      formatter={(v, n) => [v, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {kindPieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dotByLabel[entry.name] ?? PIE_FALLBACK }} />
                      <span className="text-slate-200">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-slate-100">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No app type data available.</p>
          )}
        </section>
      </div>

      {/* Stopped apps alert */}
      {stoppedApps.length > 0 && (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
            ⚠ {stoppedApps.length} App{stoppedApps.length > 1 ? 's' : ''} Not Running
          </h3>
          <div className="flex flex-wrap gap-2">
            {stoppedApps.map((app) => (
              <span key={app.resourceId} className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-900/20 px-2.5 py-1 text-xs text-amber-200">
                <KindBadge kind={app.kind} />
                <span>{app.name}</span>
                <span className="text-amber-500">— {app.state}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Full app table */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">All Apps ({filtered.length})</h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* State filter */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
              {(['all', 'Running', 'Stopped'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStateFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition ${stateFilter === f ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {f === 'all' ? 'All States' : f}
                </button>
              ))}
            </div>
            {/* Kind filter */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
              {(['all', 'Web App', 'Function App', 'Logic App'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setKindFilter(f)}
                  className={`px-3 py-1.5 font-semibold transition ${kindFilter === f ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {f === 'all' ? 'All Types' : f}
                </button>
              ))}
            </div>
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps..."
              className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No apps match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Subscription</th>
                  <th className="px-3 py-2">SKU</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <AppRow key={app.resourceId} app={app} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AppRow({ app }: { app: AppFunctionItem }) {
  const isRunning = app.state.toLowerCase() === 'running';
  return (
    <tr className={`border-b border-white/5 transition hover:bg-slate-800/30 ${!isRunning ? 'bg-amber-950/10' : ''}`}>
      <td className="px-3 py-2.5">
        <span className="font-medium text-slate-100">{app.name}</span>
      </td>
      <td className="px-3 py-2.5">
        <KindBadge kind={app.kind} />
      </td>
      <td className="px-3 py-2.5">
        <StateChip state={app.state} />
      </td>
      <td className="px-3 py-2.5 text-slate-300">{app.location || '—'}</td>
      <td className="px-3 py-2.5 text-slate-300">{app.subscriptionName || '—'}</td>
      <td className="px-3 py-2.5">
        {app.sku ? (
          <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[11px] font-mono text-slate-300">{app.sku}</span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </td>
    </tr>
  );
}
