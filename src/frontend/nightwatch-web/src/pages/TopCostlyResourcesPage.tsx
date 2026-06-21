import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { TopCostlyResourcesDashboard } from '../types/dashboard';

interface TopCostlyResourcesPageProps {
  refreshTick: number;
}

const SLICE_COLORS = [
  '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#8b5cf6',
  '#ec4899', '#14b8a6', '#ef4444', '#6366f1', '#84cc16',
];

export function TopCostlyResourcesPage({ refreshTick }: TopCostlyResourcesPageProps) {
  const [data, setData] = useState<TopCostlyResourcesDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(prev => prev || data === null);
    setLoadError(null);

    nightWatchClient.getTopCostlyResourcesDashboard(refreshTick)
      .then(response => { if (isMounted) { setData(response); setIsLoading(false); } })
      .catch(err => { if (isMounted) { setLoadError(err instanceof Error ? err.message : 'Unable to load top costly resources.'); setIsLoading(false); } });

    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  const pieData = data.resources.map(r => ({ name: r.resourceName, value: r.monthlyCostEur, full: r }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Top 10 Costly Resources</h2>
        <p className="mt-2 text-sm text-slate-300">
          Current month spend broken down by individual Azure resource, sourced directly from Azure Cost Management.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          Total (top 10): €{data.totalCostEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          &nbsp;·&nbsp;
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Spend Distribution</h3>
        <div className="h-[420px] w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius="38%"
                outerRadius="68%"
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={activeIndex === index ? 2 : 1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`€${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Monthly Cost']}
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, color: '#e2e8f0' }}
              />
              <Legend
                formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Resource Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Subscription</th>
                <th className="px-3 py-2 text-right">Monthly Cost (€)</th>
                <th className="px-3 py-2 text-right">% of Top 10</th>
              </tr>
            </thead>
            <tbody>
              {data.resources.map((resource, index) => {
                const pct = data.totalCostEur > 0 ? (resource.monthlyCostEur / data.totalCostEur) * 100 : 0;
                return (
                  <tr
                    key={resource.resourceId}
                    className="border-b border-white/5 transition hover:bg-slate-800/40"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    <td className="px-3 py-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-white">{resource.resourceName}</p>
                      <p className="mt-0.5 max-w-xs truncate text-[11px] text-slate-400" title={resource.resourceId}>{resource.resourceId}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{resource.resourceType}</td>
                    <td className="px-3 py-2 text-slate-300">{resource.subscriptionName}</td>
                    <td className="px-3 py-2 text-right font-semibold text-cyan-200">
                      €{resource.monthlyCostEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                          />
                        </div>
                        <span className="w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10">
                <td colSpan={4} className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-400">Total (top 10)</td>
                <td className="px-3 py-2 text-right font-bold text-white">
                  €{data.totalCostEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right text-slate-400">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
