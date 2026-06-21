import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { WastageTrackerDashboard, WastageItem } from '../types/dashboard';

interface WastageTrackerPageProps {
  refreshTick: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Underutilized VM':     '#f43f5e',
  'Stopped VM':           '#fb923c',
  'Unattached Disk':      '#f59e0b',
  'Orphaned NIC':         '#8b5cf6',
  'Abandoned Public IP':  '#06b6d4',
  'Orphaned Snapshot':    '#64748b',
  'Other':                '#475569',
};

function catColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#475569';
}

function fmt(n: number) {
  return `€${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WastageTrackerPage({ refreshTick }: WastageTrackerPageProps) {
  const [data, setData] = useState<WastageTrackerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);

    nightWatchClient.getWastageTrackerDashboard(refreshTick)
      .then((res) => { if (isMounted) { setData(res); setIsLoading(false); } })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load Wastage Tracker data.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  return <WastageContent data={data} />;
}

function WastageContent({ data }: { data: WastageTrackerDashboard }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // ── Derived data ─────────────────────────────────────────────────────────

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; waste: number }> = {};
    for (const item of data.wastageItems) {
      if (!map[item.category]) map[item.category] = { count: 0, waste: 0 };
      map[item.category].count++;
      map[item.category].waste += item.estimatedMonthlyWasteEur;
    }
    return Object.entries(map)
      .map(([cat, v]) => ({ category: cat, count: v.count, waste: Math.round(v.waste * 100) / 100 }))
      .sort((a, b) => b.waste - a.waste);
  }, [data.wastageItems]);

  const subscriptionBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of data.wastageItems) {
      const sub = item.subscriptionName || 'Unknown';
      map[sub] = (map[sub] ?? 0) + item.estimatedMonthlyWasteEur;
    }
    return Object.entries(map)
      .map(([sub, waste]) => ({ sub: sub.length > 24 ? sub.slice(0, 24) + '…' : sub, waste: Math.round(waste * 100) / 100 }))
      .sort((a, b) => b.waste - a.waste)
      .slice(0, 12);
  }, [data.wastageItems]);

  const top10Resources = useMemo(() =>
    [...data.wastageItems]
      .sort((a, b) => b.estimatedMonthlyWasteEur - a.estimatedMonthlyWasteEur)
      .slice(0, 10)
      .map((r) => ({ name: r.resourceName.length > 26 ? r.resourceName.slice(0, 26) + '…' : r.resourceName, waste: r.estimatedMonthlyWasteEur, category: r.category })),
    [data.wastageItems]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(data.wastageItems.map((i) => i.category)))], [data.wastageItems]);

  const filtered = useMemo(() => data.wastageItems.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (search.trim()) {
      const t = search.trim().toLowerCase();
      return item.resourceName.toLowerCase().includes(t) || item.subscriptionName.toLowerCase().includes(t) || item.category.toLowerCase().includes(t);
    }
    return true;
  }), [data.wastageItems, categoryFilter, search]);

  const annualWaste = data.totalEstimatedMonthlyWasteEur * 12;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Wastage Tracker</h2>
        <p className="mt-2 text-sm text-slate-300">
          Identifies underutilized running VMs (flagged by Azure Advisor), stopped-but-allocated VMs, orphaned disks, NICs, public IPs, and snapshots burning Azure budget. Deallocated VMs are excluded — they incur no compute cost.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalWastedResources} wasteful resources · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="col-span-2 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-rose-400">Est. Monthly Waste</p>
          <p className="mt-2 text-4xl font-black text-rose-200">{fmt(data.totalEstimatedMonthlyWasteEur)}</p>
          <p className="mt-1 text-sm text-rose-400/70">{fmt(annualWaste)} / year if unaddressed</p>
        </div>
        <div className="rounded-2xl border border-amber-500/25 bg-amber-950/10 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-400">Wasteful Resources</p>
          <p className="mt-2 text-4xl font-black text-amber-200">{data.totalWastedResources}</p>
          <p className="mt-1 text-sm text-amber-400/70">{categoryBreakdown.length} categories</p>
        </div>
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Avg Waste / Resource</p>
          <p className="mt-2 text-4xl font-black text-slate-200">
            {data.totalWastedResources > 0 ? fmt(Math.round(data.totalEstimatedMonthlyWasteEur / data.totalWastedResources * 100) / 100) : '€0'}
          </p>
          <p className="mt-1 text-sm text-slate-500">per month</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Waste by category — donut */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Waste by Category</h3>
          {categoryBreakdown.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="h-[180px] w-[180px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%" cy="50%"
                      innerRadius="40%" outerRadius="70%"
                      paddingAngle={2}
                      dataKey="waste"
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.category} fill={catColor(entry.category)} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                      formatter={(v) => [fmt(Number(v)), 'Monthly Waste']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {categoryBreakdown.map((entry) => (
                  <div key={entry.category} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: catColor(entry.category) }} />
                      <span className="truncate text-xs text-slate-200">{entry.category}</span>
                      <span className="text-[10px] text-slate-500">×{entry.count}</span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-rose-300">{fmt(entry.waste)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No wastage data found.</p>
          )}
        </section>

        {/* Top 10 resources — horizontal bar */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Top 10 Costliest Resources</h3>
          {top10Resources.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10Resources} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                    formatter={(v) => [fmt(Number(v)), 'Monthly Waste']}
                  />
                  <Bar dataKey="waste" radius={[0, 3, 3, 0]}>
                    {top10Resources.map((entry) => (
                      <Cell key={entry.name} fill={catColor(entry.category)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No data available.</p>
          )}
        </section>
      </div>

      {/* Waste by subscription */}
      {subscriptionBreakdown.length > 1 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Waste by Subscription</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subscriptionBreakdown} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="sub" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                  formatter={(v) => [fmt(Number(v)), 'Monthly Waste']}
                />
                <Bar dataKey="waste" fill="#f43f5e" radius={[3, 3, 0, 0]}>
                  {subscriptionBreakdown.map((_, i) => (
                    <Cell key={i} fill={`hsl(${350 + i * 12}, 80%, ${55 - i * 2}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Category proportion bar */}
      {categoryBreakdown.length > 0 && data.totalEstimatedMonthlyWasteEur > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Waste Composition</h3>
          <div className="flex h-5 w-full overflow-hidden rounded-full">
            {categoryBreakdown.map((entry) => (
              <div
                key={entry.category}
                title={`${entry.category}: ${fmt(entry.waste)}`}
                style={{ width: `${(entry.waste / data.totalEstimatedMonthlyWasteEur) * 100}%`, background: catColor(entry.category) }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {categoryBreakdown.map((entry) => (
              <div key={entry.category} className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: catColor(entry.category) }} />
                {entry.category} <span className="text-slate-500">({((entry.waste / data.totalEstimatedMonthlyWasteEur) * 100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full resource table */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            All Wasteful Resources ({filtered.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-rose-400/50 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
              ))}
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources..."
              className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-rose-400/50 focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No resources match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Subscription</th>
                  <th className="px-3 py-2 text-right">Monthly Waste</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <WastageRow key={`${item.resourceId}-${i}`} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function WastageRow({ item }: { item: WastageItem }) {
  return (
    <tr className="border-b border-white/5 transition hover:bg-slate-800/30">
      <td className="px-3 py-2.5">
        <span className="font-medium text-slate-100">{item.resourceName}</span>
      </td>
      <td className="px-3 py-2.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: `${catColor(item.category)}22`, color: catColor(item.category) }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: catColor(item.category) }} />
          {item.category}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-300">{item.subscriptionName || '—'}</td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-semibold text-rose-300">{fmt(item.estimatedMonthlyWasteEur)}</span>
      </td>
      <td className="px-3 py-2.5 max-w-xs">
        <span className="text-xs text-slate-400">{item.reason}</span>
      </td>
    </tr>
  );
}
