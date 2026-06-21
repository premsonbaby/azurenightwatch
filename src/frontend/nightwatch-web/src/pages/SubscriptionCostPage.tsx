import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { SubscriptionCostDashboard } from '../types/dashboard';

interface SubscriptionCostPageProps { refreshTick: number; }

const PERIOD_OPTIONS = [
  { label: '3 Months', value: 3 },
  { label: '6 Months', value: 6 },
  { label: '12 Months', value: 12 },
];

// Distinct colours for up to 10 subscriptions
const SUB_COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e',
  '#3b82f6', '#ec4899', '#84cc16', '#f97316', '#a78bfa',
];

function fmt(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(1)}k`;
  return `€${n.toFixed(2)}`;
}

export function SubscriptionCostPage({ refreshTick }: SubscriptionCostPageProps) {
  const [months, setMonths] = useState(3);
  const [data, setData] = useState<SubscriptionCostDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    nightWatchClient.getSubscriptionCostDashboard(months, refreshTick)
      .then((res) => { if (isMounted) { setData(res); setIsLoading(false); } })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load subscription cost data.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [months, refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  return <SubscriptionCostContent data={data} months={months} setMonths={setMonths} />;
}

function SubscriptionCostContent({
  data,
  months,
  setMonths,
}: {
  data: SubscriptionCostDashboard;
  months: number;
  setMonths: (m: number) => void;
}) {
  // Stable color map keyed by subscription ID
  const allSubIds = useMemo(
    () => Array.from(new Set(data.monthlyBreakdown.flatMap(m => m.subscriptions.map(s => s.subscriptionId)))),
    [data.monthlyBreakdown],
  );
  const colorMap = useMemo(
    () => Object.fromEntries(allSubIds.map((id, i) => [id, SUB_COLORS[i % SUB_COLORS.length]])),
    [allSubIds],
  );

  // Chart data: one entry per month, keys are subscription names
  const chartData = useMemo(
    () => data.monthlyBreakdown.map(m => {
      const entry: Record<string, string | number> = { month: m.monthLabel };
      for (const s of m.subscriptions) {
        entry[s.subscriptionName] = s.costEur;
      }
      return entry;
    }),
    [data.monthlyBreakdown],
  );

  // Unique subscription names for bars
  const subNames = useMemo(() => {
    const names = new Map<string, string>(); // name -> id
    for (const m of data.monthlyBreakdown) {
      for (const s of m.subscriptions) names.set(s.subscriptionName, s.subscriptionId);
    }
    return Array.from(names.entries()).map(([name, id]) => ({ name, id }));
  }, [data.monthlyBreakdown]);

  const handleDownload = useCallback(() => {
    const lines: string[] = [];

    // Header
    lines.push(`NightWatch — Subscription Cost Report`);
    lines.push(`Period: Last ${data.months} months`);
    lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString()}`);
    lines.push('');

    // KPI summary
    lines.push('SUMMARY');
    lines.push(`Total Cost,${data.totalCostEur.toFixed(2)}`);
    lines.push(`Avg Monthly Cost,${data.avgMonthlyCostEur.toFixed(2)}`);
    lines.push(`Current Month Cost,${data.currentMonthCostEur.toFixed(2)}`);
    lines.push('');

    // Monthly breakdown
    lines.push('MONTHLY BREAKDOWN');
    const subNamesAll = Array.from(new Set(data.monthlyBreakdown.flatMap(m => m.subscriptions.map(s => s.subscriptionName))));
    lines.push(['Month', 'Total (EUR)', ...subNamesAll].join(','));
    for (const m of data.monthlyBreakdown) {
      const costs = subNamesAll.map(name => {
        const found = m.subscriptions.find(s => s.subscriptionName === name);
        return found ? found.costEur.toFixed(2) : '0.00';
      });
      lines.push([m.monthLabel, m.totalCostEur.toFixed(2), ...costs].join(','));
    }
    lines.push('');

    // Subscription summaries
    lines.push('SUBSCRIPTION SUMMARY');
    lines.push('Subscription,Total (EUR),Avg Monthly (EUR),Peak Month (EUR),Peak Month');
    for (const s of data.subscriptionSummaries) {
      lines.push([
        `"${s.subscriptionName}"`,
        s.totalCostEur.toFixed(2),
        s.avgMonthlyCostEur.toFixed(2),
        s.peakMonthCostEur.toFixed(2),
        s.peakMonth,
      ].join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscription-cost-${data.months}m-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const hasCostData = data.totalCostEur > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
        <PageBackButton />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Cost Intelligence</p>
            <h2 className="mt-1 text-2xl font-black text-white">Subscription Cost</h2>
            <p className="mt-1 text-sm text-slate-400">
              Monthly Azure spend broken down by subscription — compare trends across your estate.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Period selector */}
            <div className="flex rounded-xl border border-white/10 bg-slate-800/60 p-1 gap-1">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMonths(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    months === opt.value
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Download button */}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download CSV
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Generated {new Date(data.generatedAt).toLocaleString()} · {data.months}-month window
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Spend', value: fmt(data.totalCostEur), sub: `Last ${data.months} months`, color: 'text-amber-300' },
          { label: 'Avg Monthly', value: fmt(data.avgMonthlyCostEur), sub: 'Per month average', color: 'text-cyan-300' },
          { label: 'Current Month', value: fmt(data.currentMonthCostEur), sub: 'Month to date', color: 'text-emerald-300' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-400">{card.label}</p>
            <p className={`mt-2 text-3xl font-black ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-300">
          Monthly Cost by Subscription
        </h3>
        {!hasCostData ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            No cost data available for this period. Ensure Cost Management API access is configured.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => fmt(v as number)}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                  formatter={(value: unknown, name: unknown) => [`€${(value as number).toFixed(2)}`, String(name)]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                {subNames.map(({ name, id }) => (
                  <Bar key={id} dataKey={name} stackId="a" fill={colorMap[id]} radius={subNames[subNames.length - 1].id === id ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                    {chartData.map((_, idx) => (
                      <Cell key={idx} fill={colorMap[id]} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Subscription summary table */}
      {data.subscriptionSummaries.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-300">
            Subscription Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Subscription</th>
                  <th className="pb-3 pr-4 font-medium text-right">{data.months}M Total</th>
                  <th className="pb-3 pr-4 font-medium text-right">Avg / Month</th>
                  <th className="pb-3 pr-4 font-medium text-right">Peak Month</th>
                  <th className="pb-3 font-medium text-right">Peak Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.subscriptionSummaries.map((s, i) => (
                  <tr key={s.subscriptionId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: colorMap[s.subscriptionId] ?? SUB_COLORS[i % SUB_COLORS.length] }}
                        />
                        <span className="font-medium text-slate-100">{s.subscriptionName}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-amber-300">{fmt(s.totalCostEur)}</td>
                    <td className="py-3 pr-4 text-right text-slate-300">{fmt(s.avgMonthlyCostEur)}</td>
                    <td className="py-3 pr-4 text-right text-slate-400">{s.peakMonth}</td>
                    <td className="py-3 text-right text-slate-300">{fmt(s.peakMonthCostEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly detail table */}
      {data.monthlyBreakdown.length > 0 && hasCostData && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-300">
            Monthly Detail
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Month</th>
                  <th className="pb-3 pr-4 font-medium text-right">Total</th>
                  {subNames.map(({ name }) => (
                    <th key={name} className="pb-3 pr-4 font-medium text-right">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.monthlyBreakdown.map(m => (
                  <tr key={m.month} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 pr-4 font-medium text-slate-200">{m.monthLabel}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-amber-300">{fmt(m.totalCostEur)}</td>
                    {subNames.map(({ name }) => {
                      const found = m.subscriptions.find(s => s.subscriptionName === name);
                      return (
                        <td key={name} className="py-3 pr-4 text-right text-slate-400">
                          {found ? fmt(found.costEur) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
