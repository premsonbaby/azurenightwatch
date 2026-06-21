import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { OrphanedResourcesDashboard } from '../types/dashboard';

interface OrphanedResourcesPageProps {
  refreshTick: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Unattached Disk': '#f43f5e',
  'Orphaned NIC': '#8b5cf6',
  'Abandoned Public IP': '#06b6d4',
  'Orphaned Snapshot': '#f59e0b',
  'Other': '#64748b',
};

function categoryColor(cat: string) {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (cat.toLowerCase().includes(key.toLowerCase().split(' ')[0])) return color;
  }
  return CATEGORY_COLORS['Other'];
}

const fmt = (v: number) =>
  `€${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function OrphanedResourcesPage({ refreshTick }: OrphanedResourcesPageProps) {
  const [data, setData] = useState<OrphanedResourcesDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getOrphanedResourcesDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;
  return <OrphanedContent data={data} />;
}

function OrphanedContent({ data }: { data: OrphanedResourcesDashboard }) {
  const [search, setSearch] = useState('');

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of data.resources) {
      map[r.category] = (map[r.category] ?? 0) + r.estimatedMonthlyWasteEur;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [data.resources]);

  const filtered = useMemo(() =>
    data.resources.filter((r) =>
      !search.trim() ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase()) ||
      r.subscriptionName.toLowerCase().includes(search.toLowerCase()),
    ), [data.resources, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Orphaned Resources</h2>
        <p className="mt-2 text-sm text-slate-300">
          Unattached disks, dangling NICs, abandoned public IPs, and unused snapshots accumulating cost with no active workload attached.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          Source: Azure Resource Graph · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total Orphaned', value: data.totalOrphanedResources, text: 'text-amber-200', accent: 'border-amber-400/25 bg-amber-500/8' },
          { label: 'Monthly Waste', value: fmt(data.estimatedMonthlyWasteEur), text: 'text-rose-200', accent: 'border-rose-400/25 bg-rose-500/8' },
          { label: 'Unattached Disks', value: data.orphanedDisks, text: 'text-rose-300', accent: 'border-rose-400/20 bg-rose-500/6' },
          { label: 'Orphaned NICs', value: data.orphanedNics, text: 'text-violet-300', accent: 'border-violet-400/20 bg-violet-500/6' },
          { label: 'Abandoned PIPs', value: data.orphanedPublicIps, text: 'text-cyan-300', accent: 'border-cyan-400/20 bg-cyan-500/6' },
          { label: 'Old Snapshots', value: data.orphanedSnapshots, text: 'text-slate-300', accent: 'border-slate-700/40 bg-slate-800/30' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.accent}`}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{s.label}</p>
            <p className={`mt-2 text-2xl font-black ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {categoryData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Donut */}
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Waste by Category</h3>
            <div className="flex items-center gap-4">
              <div className="h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius="38%" outerRadius="68%" paddingAngle={2} dataKey="value">
                      {categoryData.map((e) => (
                        <Cell key={e.name} fill={categoryColor(e.name)} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                      formatter={(v) => [fmt(Number(v)), 'Monthly Waste']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {categoryData.map((e) => (
                  <div key={e.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categoryColor(e.name) }} />
                      <span className="text-slate-300">{e.name}</span>
                    </div>
                    <span className="font-semibold text-rose-300">{fmt(e.value)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bar */}
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Monthly Cost by Category</h3>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                    formatter={(v) => [fmt(Number(v)), 'Monthly Waste']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryData.map((e) => (
                      <Cell key={e.name} fill={categoryColor(e.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {/* Resource table */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            All Orphaned Resources ({filtered.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, category, subscription..."
            className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400/50 focus:outline-none"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {data.totalOrphanedResources === 0 ? 'No orphaned resources found — great hygiene!' : 'No results match your filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Subscription</th>
                  <th className="px-3 py-2 text-right">Monthly Waste</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-100">{r.name}</p>
                      <p className="font-mono text-[10px] text-slate-500 truncate max-w-xs">{r.resourceType}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: categoryColor(r.category) }} />
                        <span className="text-slate-300">{r.category}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{r.subscriptionName}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-rose-300">{fmt(r.estimatedMonthlyWasteEur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td colSpan={3} className="px-3 py-2 text-xs text-slate-400">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-rose-200">{fmt(data.estimatedMonthlyWasteEur)}/mo</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
