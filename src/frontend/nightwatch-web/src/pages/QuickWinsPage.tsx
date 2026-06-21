import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { PageBackButton } from '../components/PageBackButton';
import type { QuickWinsDashboard } from '../types/dashboard';

interface QuickWinsPageProps {
  refreshTick: number;
}

export function QuickWinsPage({ refreshTick }: QuickWinsPageProps) {
  const [data, setData] = useState<QuickWinsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    nightWatchClient.getQuickWinsDashboard(refreshTick)
      .then(setData)
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [refreshTick]);

  if (loading) return <div className="p-8 text-slate-400 animate-pulse">Loading quick wins...</div>;
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data) return null;

  const priorityColor = (p: string) =>
    p === 'High' ? 'border-red-500/50 bg-red-500/10 text-red-300' :
    p === 'Medium' ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300' :
    'border-blue-500/50 bg-blue-500/10 text-blue-300';

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Idle & orphaned resources — immediate savings</h2>
        <p className="mt-2 text-sm text-slate-400">Generated {new Date(data.generatedAt).toLocaleString()}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Total Quick Wins</p>
          <p className="mt-2 text-4xl font-black text-white">{data.totalQuickWins}</p>
          <p className="text-sm text-slate-400">actionable items</p>
        </article>
        <article className="rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Potential Monthly Savings</p>
          <p className="mt-2 text-4xl font-black text-white">€{(data.totalPotentialSavingsEur ?? 0).toFixed(0)}</p>
          <p className="text-sm text-slate-400">per month</p>
        </article>
        <article className="rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Annual Opportunity</p>
          <p className="mt-2 text-4xl font-black text-white">€{((data.totalPotentialSavingsEur ?? 0) * 12).toFixed(0)}</p>
          <p className="text-sm text-slate-400">per year</p>
        </article>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Prioritised Opportunities</h3>
        {data.items.length === 0 ? (
          <p className="text-slate-400 text-sm">No quick wins detected — all clear!</p>
        ) : (
          <div className="space-y-3">
            {data.items.map((item, idx) => (
              <article key={idx} className={`rounded-xl border p-4 ${priorityColor(item.priority)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">{item.priority}</span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs text-slate-400">{item.issueType}</span>
                    </div>
                    <p className="font-semibold text-white">{item.resourceName}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.resourceType.split('/').pop()} · {item.subscriptionName}</p>
                    <p className="text-sm text-slate-200 mt-2">{item.recommendation}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-emerald-300">€{(item.estimatedMonthlySavingsEur ?? 0).toFixed(0)}</p>
                    <p className="text-[10px] text-slate-400 uppercase">/ month</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
