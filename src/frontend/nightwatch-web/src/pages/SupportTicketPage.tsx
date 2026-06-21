import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { SupportTicketDashboard } from '../types/dashboard';

interface SupportTicketPageProps { refreshTick: number; }

function severityBadge(sev: string) {
  const s = sev.toLowerCase();
  if (s === 'critical' || s === 'sev 1' || s === 'a') return { bg: 'bg-red-500/20', text: 'text-red-300' };
  if (s === 'high' || s === 'sev 2' || s === 'b') return { bg: 'bg-orange-500/20', text: 'text-orange-300' };
  if (s === 'moderate' || s === 'sev 3' || s === 'c') return { bg: 'bg-amber-500/20', text: 'text-amber-300' };
  return { bg: 'bg-slate-500/20', text: 'text-slate-300' };
}

function ageBadge(days: number) {
  if (days > 30) return 'text-red-400';
  if (days > 14) return 'text-amber-400';
  return 'text-slate-400';
}

export function SupportTicketPage({ refreshTick }: SupportTicketPageProps) {
  const [data, setData] = useState<SupportTicketDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getSupportTicketDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const kpis = [
    { label: 'Open Tickets', value: data.totalOpenTickets, color: 'text-cyan-300' },
    { label: 'Critical', value: data.criticalCount, color: data.criticalCount > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'High', value: data.highCount, color: data.highCount > 0 ? 'text-orange-400' : 'text-emerald-400' },
    { label: 'Moderate', value: data.moderatCount, color: 'text-amber-400' },
  ];

  const sorted = [...data.tickets].sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, minimal: 3 };
    return (sevOrder[a.severity.toLowerCase()] ?? 9) - (sevOrder[b.severity.toLowerCase()] ?? 9);
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Support Ticket Tracker</h2>
        <p className="mt-2 text-sm text-slate-300">Open Azure support tickets by severity across your subscriptions</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalOpenTickets} open tickets · {data.criticalCount} critical · {data.highCount} high · {data.moderatCount} moderate
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center">
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
            <p className="mt-1 text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {data.tickets.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-12 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-3 text-lg font-semibold text-emerald-400">No Open Tickets</p>
          <p className="mt-1 text-sm text-slate-400">All support tickets are resolved.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sorted.map((t) => {
                  const sev = severityBadge(t.severity);
                  return (
                    <tr key={t.ticketId} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-white max-w-xs truncate">{t.title}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.text}`}>{t.severity}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{t.serviceName}</td>
                      <td className="px-4 py-3 text-slate-400">{t.subscriptionName}</td>
                      <td className="px-4 py-3 text-slate-300">{t.status}</td>
                      <td className={`px-4 py-3 text-right font-medium ${ageBadge(t.ageDays)}`}>{t.ageDays}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
