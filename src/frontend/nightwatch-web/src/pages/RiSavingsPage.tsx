import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { RiSavingsDashboard } from '../types/dashboard';

interface RiSavingsPageProps {
  refreshTick: number;
}

const IMPACT_COLORS: Record<string, string> = {
  high: '#f43f5e',
  medium: '#f59e0b',
  low: '#10b981',
};

function impactColor(impact: string) {
  return IMPACT_COLORS[impact.toLowerCase()] ?? '#64748b';
}

export function RiSavingsPage({ refreshTick }: RiSavingsPageProps) {
  const [data, setData] = useState<RiSavingsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);

    nightWatchClient.getRiSavingsDashboard(refreshTick)
      .then((response) => { if (isMounted) { setData(response); setIsLoading(false); } })
      .catch((error) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load savings data.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  return <RiSavingsContent data={data} />;
}

function RiSavingsContent({ data }: { data: RiSavingsDashboard }) {
  const barData = useMemo(
    () => data.recommendations.map((r) => ({
      name: r.recommendationType.length > 35 ? r.recommendationType.slice(0, 35) + '…' : r.recommendationType,
      annual: r.estimatedAnnualSavingsEur,
      monthly: r.estimatedMonthlySavingsEur,
      impact: r.impact,
    })),
    [data.recommendations],
  );

  const hasData = data.recommendationCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Reserved Instance & Savings</h2>
        <p className="mt-2 text-sm text-slate-300">
          Genuine commitment-based savings opportunities from Azure Advisor — Reserved Instances and Savings Plans only.
          Shutdown and right-sizing recommendations are excluded; those appear in Wastage Tracker.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          Source: Azure Advisor · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`rounded-2xl border p-5 text-center ${hasData ? 'border-emerald-400/25 bg-emerald-500/8' : 'border-slate-700/40 bg-slate-800/30'}`}>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Annual Savings Potential</p>
          <p className={`mt-3 text-4xl font-black ${hasData ? 'text-emerald-300' : 'text-slate-500'}`}>
            €{data.totalEstimatedAnnualSavingsEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">if all commitments purchased</p>
        </div>
        <div className={`rounded-2xl border p-5 text-center ${hasData ? 'border-teal-400/25 bg-teal-500/8' : 'border-slate-700/40 bg-slate-800/30'}`}>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Monthly Savings Potential</p>
          <p className={`mt-3 text-4xl font-black ${hasData ? 'text-teal-300' : 'text-slate-500'}`}>
            €{data.totalEstimatedMonthlySavingsEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">average per month</p>
        </div>
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Recommendations</p>
          <p className="mt-3 text-4xl font-black text-slate-200">{data.recommendationCount}</p>
          <p className="mt-1 text-xs text-slate-500">from Azure Advisor</p>
        </div>
      </div>

      {/* No data state */}
      {!hasData && (
        <section className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-8 text-center">
          <p className="text-2xl">✓</p>
          <p className="mt-3 text-base font-semibold text-slate-200">No commitment recommendations at this time</p>
          <p className="mt-2 max-w-xl mx-auto text-sm text-slate-400">
            Azure Advisor generates Reserved Instance and Savings Plan recommendations based on 30+ days of consistent
            resource usage at sufficient scale. Your current environment does not yet meet the threshold for a
            commitment recommendation, or Advisor has determined on-demand pricing is already optimal.
          </p>
          <div className="mt-6 rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 text-left max-w-md mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">When recommendations appear</p>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>· Same VM SKU running consistently for 30+ days</li>
              <li>· Sufficient usage volume to justify a commitment</li>
              <li>· Reserved pricing cheaper than on-demand for your region</li>
            </ul>
          </div>
        </section>
      )}

      {/* Bar chart */}
      {hasData && barData.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Savings by Recommendation
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                  formatter={(v) => [`€${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Annual Savings']}
                />
                <Bar dataKey="annual" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={impactColor(entry.impact)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Recommendations table */}
      {hasData && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Recommendations ({data.recommendationCount})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2">Recommendation</th>
                  <th className="px-3 py-2">Term</th>
                  <th className="px-3 py-2">Impact</th>
                  <th className="px-3 py-2 text-right">Monthly Saving</th>
                  <th className="px-3 py-2 text-right">Annual Saving</th>
                </tr>
              </thead>
              <tbody>
                {data.recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-100">{r.recommendationType}</td>
                    <td className="px-3 py-3 text-slate-400">{r.term || '—'}</td>
                    <td className="px-3 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                        style={{ background: impactColor(r.impact) + '20', color: impactColor(r.impact) }}
                      >
                        {r.impact}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-teal-300">
                      €{r.estimatedMonthlySavingsEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-300">
                      €{r.estimatedAnnualSavingsEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Figures sourced directly from Azure Advisor. Verify against your actual billing before purchasing commitments.
          </p>
        </section>
      )}
    </div>
  );
}
