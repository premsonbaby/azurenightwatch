import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { VmssHealthDashboard } from '../types/dashboard';

interface VmssHealthPageProps { refreshTick: number; }

function stateBadge(state: string) {
  const s = state.toLowerCase();
  if (s === 'succeeded') return 'bg-emerald-500/20 text-emerald-300';
  if (s === 'updating') return 'bg-amber-500/20 text-amber-300';
  if (s === 'failed') return 'bg-red-500/20 text-red-300';
  return 'bg-slate-500/20 text-slate-300';
}

export function VmssHealthPage({ refreshTick }: VmssHealthPageProps) {
  const [data, setData] = useState<VmssHealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getVmssHealthDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const kpis = [
    { label: 'Scale Sets', value: data.totalScaleSets, color: 'text-cyan-300' },
    { label: 'Running', value: data.runningCount, color: 'text-emerald-400' },
    { label: 'Failed', value: data.failedCount, color: data.failedCount > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Total Instances', value: data.totalInstances, color: 'text-violet-400' },
  ];

  const capacityData = data.scaleSets
    .filter((s) => s.capacity > 0)
    .sort((a, b) => b.capacity - a.capacity)
    .slice(0, 10)
    .map((s) => ({ name: s.name.length > 20 ? `${s.name.slice(0, 18)}…` : s.name, capacity: s.capacity, state: s.provisioningState }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">VMSS Health</h2>
        <p className="mt-2 text-sm text-slate-300">Virtual Machine Scale Sets — capacity, state, and upgrade policy across your tenant</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalScaleSets} scale sets · {data.runningCount} running · {data.failedCount} failed · {data.totalInstances} instances
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

      {capacityData.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Top Scale Sets by Capacity</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={capacityData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={115} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="capacity" radius={[0, 4, 4, 0]}>
                {capacityData.map((e) => (
                  <Cell key={e.name} fill={e.state.toLowerCase() === 'failed' ? '#f43f5e' : e.state.toLowerCase() === 'updating' ? '#f59e0b' : '#06b6d4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.scaleSets.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Scale Set</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">SKU</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Instances</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Upgrade Policy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.scaleSets.map((s) => (
                  <tr key={s.resourceId} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs font-mono">{s.sku}</td>
                    <td className="px-4 py-3 text-right text-cyan-300 font-bold">{s.capacity}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.upgradePolicy.toLowerCase() === 'automatic' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{s.upgradePolicy}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.subscriptionName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadge(s.provisioningState)}`}>{s.provisioningState}</span>
                    </td>
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
