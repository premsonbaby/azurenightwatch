import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { ServiceHealthDashboard } from '../types/dashboard';

interface ServiceHealthPageProps { refreshTick: number; }

function eventTypeBadge(type: string) {
  const t = type.toLowerCase();
  if (t.includes('incident')) return { bg: 'bg-red-500/20', text: 'text-red-300' };
  if (t.includes('maintenance')) return { bg: 'bg-amber-500/20', text: 'text-amber-300' };
  if (t.includes('security')) return { bg: 'bg-rose-500/20', text: 'text-rose-300' };
  return { bg: 'bg-cyan-500/20', text: 'text-cyan-300' };
}

function levelBadge(level: string) {
  const l = level.toLowerCase();
  if (l === 'critical' || l === 'error') return 'text-red-400';
  if (l === 'warning') return 'text-amber-400';
  return 'text-cyan-400';
}

export function ServiceHealthPage({ refreshTick }: ServiceHealthPageProps) {
  const [data, setData] = useState<ServiceHealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getServiceHealthDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const kpis = [
    { label: 'Active Incidents', value: data.activeIncidents, color: data.activeIncidents > 0 ? 'text-red-400' : 'text-emerald-400', icon: '🔴' },
    { label: 'Planned Maintenance', value: data.plannedMaintenance, color: 'text-amber-400', icon: '🔧' },
    { label: 'Health Advisories', value: data.healthAdvisories, color: 'text-cyan-400', icon: 'ℹ' },
    { label: 'Security Advisories', value: data.securityAdvisories, color: data.securityAdvisories > 0 ? 'text-rose-400' : 'text-emerald-400', icon: '🔒' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Azure Service Health</h2>
        <p className="mt-2 text-sm text-slate-300">Active incidents, planned maintenance, and health advisories affecting your subscriptions</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.activeIncidents} incidents · {data.plannedMaintenance} maintenance · {data.healthAdvisories} advisories · {data.securityAdvisories} security advisories
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/15 bg-slate-950/70 p-5 text-center">
            <p className="text-2xl">{k.icon}</p>
            <p className={`mt-2 text-3xl font-black ${k.color}`}>{k.value}</p>
            <p className="mt-1 text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {data.events.length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-12 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-3 text-lg font-semibold text-emerald-400">All Clear</p>
          <p className="mt-1 text-sm text-slate-400">No active service health events found for your subscriptions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.events.map((ev) => {
            const badge = eventTypeBadge(ev.eventType);
            return (
              <div key={ev.eventId} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>{ev.eventType}</span>
                      <span className={`text-xs font-bold uppercase ${levelBadge(ev.level)}`}>{ev.level}</span>
                      <span className="text-xs text-slate-500">{ev.status}</span>
                    </div>
                    <p className="mt-2 font-semibold text-white">{ev.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>Service: <span className="text-slate-300">{ev.impactedService || 'Multiple'}</span></span>
                      <span>Subscription: <span className="text-slate-300">{ev.subscriptionName || 'All'}</span></span>
                      {ev.startTime && <span>Started: <span className="text-slate-300">{new Date(ev.startTime).toLocaleString()}</span></span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
