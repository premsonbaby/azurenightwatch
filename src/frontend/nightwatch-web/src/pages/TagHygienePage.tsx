import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { TagHygieneDashboard } from '../types/dashboard';

interface TagHygienePageProps {
  refreshTick: number;
}

export function TagHygienePage({ refreshTick }: TagHygienePageProps) {
  const [data, setData] = useState<TagHygieneDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getTagHygieneDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;
  return <TagHygieneContent data={data} />;
}

function CoverageBar({ percent }: { percent: number }) {
  const color = percent >= 80 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-700">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, percent)}%`, background: color }} />
      </div>
      <span className="tabular-nums text-xs" style={{ color }}>{percent.toFixed(1)}%</span>
    </div>
  );
}

function TagHygieneContent({ data }: { data: TagHygieneDashboard }) {
  const [search, setSearch] = useState('');

  const typeBarData = useMemo(
    () => data.topUntaggedTypes
      .map((t) => ({ name: t.shortType || t.resourceType.split('/').pop() || t.resourceType, untagged: t.untaggedCount, total: t.totalCount }))
      .sort((a, b) => b.untagged - a.untagged)
      .slice(0, 10),
    [data.topUntaggedTypes],
  );

  const filteredSubs = useMemo(
    () => data.subscriptionBreakdown.filter((s) =>
      !search.trim() || s.subscriptionName.toLowerCase().includes(search.toLowerCase()),
    ),
    [data.subscriptionBreakdown, search],
  );

  const taggedResources = data.totalResources - data.untaggedResources;
  const coverageColor = data.coveragePercent >= 80 ? 'text-emerald-300' : data.coveragePercent >= 50 ? 'text-amber-300' : 'text-rose-300';

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Tag Hygiene & Compliance</h2>
        <p className="mt-2 text-sm text-slate-300">
          Resource tag coverage across your Azure estate. Untagged resources impede cost allocation, ownership tracking, and policy enforcement.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          Source: Azure Resource Graph · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className={`rounded-2xl border p-5 text-center ${data.coveragePercent >= 80 ? 'border-emerald-400/25 bg-emerald-500/8' : data.coveragePercent >= 50 ? 'border-amber-400/25 bg-amber-500/8' : 'border-rose-400/25 bg-rose-500/8'}`}>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Tag Coverage</p>
          <p className={`mt-3 text-4xl font-black ${coverageColor}`}>{data.coveragePercent.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-500">of all resources tagged</p>
        </div>
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Total Resources</p>
          <p className="mt-3 text-4xl font-black text-slate-200">{data.totalResources.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">in scope</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/6 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Tagged</p>
          <p className="mt-3 text-4xl font-black text-emerald-300">{taggedResources.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">resources with tags</p>
        </div>
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/8 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Untagged</p>
          <p className="mt-3 text-4xl font-black text-rose-300">{data.untaggedResources.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">need attention</p>
        </div>
      </div>

      {/* Charts row */}
      {typeBarData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Top untagged types bar */}
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
              Top Untagged Resource Types
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeBarData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#94a3b8' }} width={90} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                    formatter={(v) => [Number(v).toLocaleString(), 'Untagged']}
                  />
                  <Bar dataKey="untagged" radius={[0, 4, 4, 0]}>
                    {typeBarData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${220 + i * 15}, 70%, 55%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Coverage gauge card */}
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 flex flex-col justify-between">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Coverage by Subscription</h3>
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-44 pr-1">
              {data.subscriptionBreakdown
                .slice()
                .sort((a, b) => a.coveragePercent - b.coveragePercent)
                .slice(0, 6)
                .map((s) => (
                  <div key={s.subscriptionId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-slate-300 max-w-[160px]" title={s.subscriptionName}>{s.subscriptionName}</span>
                    <CoverageBar percent={s.coveragePercent} />
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}

      {/* Subscription table */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Subscription Breakdown ({filteredSubs.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by subscription..."
            className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        {filteredSubs.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No subscriptions match your filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2">Subscription</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Untagged</th>
                  <th className="px-3 py-2">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs
                  .slice()
                  .sort((a, b) => a.coveragePercent - b.coveragePercent)
                  .map((s) => (
                    <tr key={s.subscriptionId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                      <td className="px-3 py-2.5 font-medium text-slate-100">{s.subscriptionName}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400">{s.totalCount.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-rose-300 font-semibold">{s.untaggedCount.toLocaleString()}</td>
                      <td className="px-3 py-2.5"><CoverageBar percent={s.coveragePercent} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
