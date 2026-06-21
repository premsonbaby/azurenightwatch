import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { VwanDashboard, Vwan, VwanHub } from '../types/dashboard';

const COLORS = ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#ef4444'];

function stateColor(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'succeeded') return 'text-emerald-400';
  if (lower === 'failed') return 'text-red-400';
  return 'text-amber-400';
}

export default function VwanPage() {
  const [data, setData] = useState<VwanDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hubFilter, setHubFilter] = useState('');

  useEffect(() => {
    nightWatchClient.getVwanDashboard()
      .then(setData)
      .catch((e: Error) => setLoadError(e?.message ?? 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const filteredHubs = data.hubs.filter(
    (h) =>
      !hubFilter ||
      h.name.toLowerCase().includes(hubFilter.toLowerCase()) ||
      h.location.toLowerCase().includes(hubFilter.toLowerCase()) ||
      h.subscriptionName.toLowerCase().includes(hubFilter.toLowerCase()),
  );

  const regionData = Object.entries(
    data.hubs.reduce<Record<string, number>>((acc, h) => {
      acc[h.location] = (acc[h.location] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const routingPreferenceData = Object.entries(
    data.hubs.reduce<Record<string, number>>((acc, h) => {
      const key = h.hubRoutingPreference || 'Default';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h1 className="mt-2 text-3xl font-black text-white">Virtual WAN</h1>
        <p className="mt-2 text-sm text-slate-300">
          Virtual WAN instances, virtual hubs and routing overview across all subscriptions
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalVwans} Virtual WAN{data.totalVwans !== 1 ? 's' : ''} · {data.totalHubs} hub{data.totalHubs !== 1 ? 's' : ''} · {data.connectedHubs} connected
        </p>
      </section>

      {/* KPI row — direct in flow, no wrapper */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Virtual WANs', value: data.totalVwans, sub: 'total instances', color: 'text-cyan-300', accent: 'border-cyan-400/25 bg-cyan-500/5' },
          { label: 'Total Hubs', value: data.totalHubs, sub: 'across all WANs', color: 'text-amber-400', accent: 'border-amber-400/25 bg-amber-500/5' },
          { label: 'Connected Hubs', value: data.connectedHubs, sub: 'in connected state', color: 'text-emerald-400', accent: 'border-emerald-400/25 bg-emerald-500/5' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-5 text-center ${kpi.accent}`}>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{kpi.label}</p>
            <p className={`mt-3 text-4xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* VWAN instance cards */}
      {data.vwans.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Virtual WANs ({data.vwans.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.vwans.map((v: Vwan) => (
              <div key={v.resourceId} className="rounded-xl border border-white/8 bg-slate-800/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-100">{v.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{v.subscriptionName}</div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stateColor(v.provisioningState)} bg-slate-700/60`}>
                    {v.provisioningState}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                  <div>
                    <div className="text-cyan-300 font-bold">{v.hubCount}</div>
                    <div className="text-slate-500">Hubs</div>
                  </div>
                  <div>
                    <div className="text-slate-300 font-bold">{v.vwanType || '—'}</div>
                    <div className="text-slate-500">Type</div>
                  </div>
                  <div>
                    <div className="text-slate-300 font-bold">{v.location}</div>
                    <div className="text-slate-500">Region</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Charts */}
      {(regionData.length > 0 || routingPreferenceData.length > 0) && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Hub Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {regionData.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-slate-400">Hubs by Region (top 8)</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionData} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }} />
                      <Bar dataKey="value" fill="#22d3ee" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {routingPreferenceData.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-slate-400">Hub Routing Preference</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={routingPreferenceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {routingPreferenceData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Hub table */}
      {data.hubs.length > 0 ? (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200 flex-1">
              Virtual Hubs ({filteredHubs.length})
            </h3>
            <input
              value={hubFilter}
              onChange={(e) => setHubFilter(e.target.value)}
              placeholder="Filter hubs…"
              className="bg-slate-800/60 text-slate-100 text-xs rounded-lg px-3 py-1.5 border border-white/10 outline-none focus:border-cyan-500/50 w-48"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {['Name', 'Subscription', 'Location', 'Address Prefix', 'Routing Preference', 'State'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHubs.map((h: VwanHub) => (
                  <tr key={h.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{h.name}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{h.subscriptionName}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{h.location}</td>
                    <td className="px-3 py-3 text-slate-300 font-mono whitespace-nowrap">{h.addressPrefix || '—'}</td>
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{h.hubRoutingPreference || 'Default'}</td>
                    <td className={`px-3 py-3 font-medium whitespace-nowrap ${stateColor(h.provisioningState)}`}>{h.provisioningState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-8 text-center">
          <p className="text-2xl">🌐</p>
          <p className="mt-3 text-base font-semibold text-slate-200">No Virtual WAN resources found</p>
          <p className="mt-2 text-sm text-slate-400">No Virtual WAN instances or hubs are deployed in the connected subscriptions.</p>
        </section>
      )}
    </div>
  );
}
