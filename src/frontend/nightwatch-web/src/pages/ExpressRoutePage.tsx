import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { ExpressRouteDashboard, ExpressRouteCircuit, ExpressRoutePeering } from '../types/dashboard';

const COLORS = ['#22d3ee', '#f59e0b', '#ef4444', '#a78bfa', '#34d399'];
const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 };

function stateColor(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'provisioned' || lower === 'enabled') return 'text-emerald-400';
  if (lower === 'notprovisioned' || lower === 'disabled') return 'text-red-400';
  return 'text-amber-400';
}

export default function ExpressRoutePage() {
  const [data, setData] = useState<ExpressRouteDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [circuitFilter, setCircuitFilter] = useState('');
  const [peeringFilter, setPeeringFilter] = useState('');

  useEffect(() => {
    nightWatchClient.getExpressRouteDashboard()
      .then(setData)
      .catch((e: Error) => setLoadError(e?.message ?? 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const filteredCircuits = data.circuits.filter((c) =>
    !circuitFilter ||
    c.name.toLowerCase().includes(circuitFilter.toLowerCase()) ||
    c.serviceProvider.toLowerCase().includes(circuitFilter.toLowerCase()) ||
    c.peeringLocation.toLowerCase().includes(circuitFilter.toLowerCase()),
  );

  const filteredPeerings = data.peerings.filter((p) =>
    !peeringFilter ||
    p.circuitName.toLowerCase().includes(peeringFilter.toLowerCase()) ||
    p.peeringType.toLowerCase().includes(peeringFilter.toLowerCase()),
  );

  const tierData = Object.entries(
    data.circuits.reduce<Record<string, number>>((acc, c) => {
      acc[c.tier] = (acc[c.tier] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const bwData = data.circuits
    .slice(0, 10)
    .map((c) => ({ name: c.name.length > 20 ? c.name.slice(0, 18) + '…' : c.name, bw: c.bandwidthMbps }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h1 className="mt-2 text-3xl font-black text-white">Express Route</h1>
        <p className="mt-2 text-sm text-slate-300">Circuit inventory, peering status and bandwidth across all subscriptions</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalCircuits} circuits · {data.provisionedCount} provisioned · {data.notProvisionedCount} not provisioned · {(data.totalBandwidthMbps / 1000).toFixed(1)} Gbps
        </p>
      </section>

      {/* KPI row — direct in flow */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Circuits', value: data.totalCircuits, sub: 'discovered', color: 'text-cyan-300', accent: 'border-cyan-400/25 bg-cyan-500/5' },
          { label: 'Provisioned', value: data.provisionedCount, sub: 'ready for use', color: 'text-emerald-400', accent: 'border-emerald-400/25 bg-emerald-500/5' },
          { label: 'Not Provisioned', value: data.notProvisionedCount, sub: 'pending / failed', color: data.notProvisionedCount > 0 ? 'text-red-400' : 'text-slate-500', accent: data.notProvisionedCount > 0 ? 'border-red-400/25 bg-red-500/5' : 'border-slate-700/40 bg-slate-800/30' },
          { label: 'Total Bandwidth', value: `${(data.totalBandwidthMbps / 1000).toFixed(1)} Gbps`, sub: 'aggregate capacity', color: 'text-amber-400', accent: 'border-amber-400/25 bg-amber-500/5' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-5 text-center ${kpi.accent}`}>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{kpi.label}</p>
            <p className={`mt-3 text-4xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {(tierData.length > 0 || bwData.length > 0) && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Circuit Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tierData.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-slate-400">Circuits by Tier</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {tierData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {bwData.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-slate-400">Bandwidth per Circuit — top 10 (Mbps)</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bwData} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="bw" fill="#22d3ee" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Circuit table */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200 flex-1">
            Circuit Inventory ({filteredCircuits.length})
          </h3>
          <input
            value={circuitFilter}
            onChange={(e) => setCircuitFilter(e.target.value)}
            placeholder="Filter circuits…"
            className="bg-slate-800/60 text-slate-100 text-xs rounded-lg px-3 py-1.5 border border-white/10 outline-none focus:border-cyan-500/50 w-48"
          />
        </div>
        {filteredCircuits.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No ExpressRoute circuits match the filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {['Name', 'Subscription', 'Location', 'Provider', 'Peering Location', 'Bandwidth', 'Circuit State', 'SP State', 'Tier'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCircuits.map((c: ExpressRouteCircuit) => (
                  <tr key={c.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{c.name}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{c.subscriptionName}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{c.location}</td>
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{c.serviceProvider}</td>
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{c.peeringLocation}</td>
                    <td className="px-3 py-3 text-cyan-300 whitespace-nowrap">{c.bandwidthMbps} Mbps</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${stateColor(c.circuitProvisioningState)}`}>{c.circuitProvisioningState}</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${stateColor(c.serviceProviderProvisioningState)}`}>{c.serviceProviderProvisioningState}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{c.tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Peerings table */}
      {data.peerings.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200 flex-1">
              Peering Details ({filteredPeerings.length})
            </h3>
            <input
              value={peeringFilter}
              onChange={(e) => setPeeringFilter(e.target.value)}
              placeholder="Filter peerings…"
              className="bg-slate-800/60 text-slate-100 text-xs rounded-lg px-3 py-1.5 border border-white/10 outline-none focus:border-cyan-500/50 w-48"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {['Circuit', 'Peering Type', 'State', 'Primary Prefix', 'Secondary Prefix'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPeerings.map((p: ExpressRoutePeering, i) => (
                  <tr key={i} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{p.circuitName}</td>
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{p.peeringType}</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${stateColor(p.state)}`}>{p.state}</td>
                    <td className="px-3 py-3 text-slate-400 font-mono whitespace-nowrap">{p.primaryPrefix || '—'}</td>
                    <td className="px-3 py-3 text-slate-400 font-mono whitespace-nowrap">{p.secondaryPrefix || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
