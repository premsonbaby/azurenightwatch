import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { AksContainerHealthDashboard } from '../types/dashboard';

interface AksContainerHealthPageProps { refreshTick: number; }

function stateBadge(state: string) {
  const s = state.toLowerCase();
  if (s === 'succeeded' || s === 'running') return 'bg-emerald-500/20 text-emerald-300';
  if (s === 'updating') return 'bg-amber-500/20 text-amber-300';
  return 'bg-red-500/20 text-red-300';
}

export function AksContainerHealthPage({ refreshTick }: AksContainerHealthPageProps) {
  const [data, setData] = useState<AksContainerHealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'clusters' | 'apps' | 'registries'>('clusters');

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getAksContainerHealthDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const kpis = [
    { label: 'AKS Clusters', value: data.totalClusters, color: 'text-cyan-300' },
    { label: 'Running', value: data.runningClusters, color: 'text-emerald-400' },
    { label: 'Container Apps', value: data.totalContainerApps, color: 'text-violet-400' },
    { label: 'Registries', value: data.totalRegistries, color: 'text-amber-400' },
  ];

  const TABS = [
    { id: 'clusters' as const, label: `Clusters (${data.totalClusters})` },
    { id: 'apps' as const, label: `Container Apps (${data.totalContainerApps})` },
    { id: 'registries' as const, label: `Registries (${data.totalRegistries})` },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">AKS & Container Health</h2>
        <p className="mt-2 text-sm text-slate-300">Kubernetes clusters, Container Apps, and Container Registries across your tenant</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalClusters} clusters · {data.totalContainerApps} container apps · {data.totalRegistries} registries
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

      <div className="flex gap-2 rounded-xl bg-slate-800/50 border border-slate-700 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${tab === t.id ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clusters' && data.clusters.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Cluster</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">K8s Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Nodes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.clusters.map((c) => (
                  <tr key={c.resourceId} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{c.kubernetesVersion}</td>
                    <td className="px-4 py-3 text-cyan-300 font-bold">{c.nodeCount}</td>
                    <td className="px-4 py-3 text-slate-300">{c.sku}</td>
                    <td className="px-4 py-3 text-slate-400">{c.subscriptionName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadge(c.provisioningState)}`}>{c.provisioningState}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'apps' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          {data.containerApps.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No Container Apps found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.containerApps.map((a) => (
                    <tr key={a.resourceId} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                      <td className="px-4 py-3 text-slate-400">{a.subscriptionName}</td>
                      <td className="px-4 py-3 text-slate-400">{a.location}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadge(a.provisioningState)}`}>{a.provisioningState}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'registries' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          {data.registries.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No Container Registries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Registry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Admin User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.registries.map((r) => (
                    <tr key={r.resourceId} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                      <td className="px-4 py-3"><span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">{r.sku}</span></td>
                      <td className="px-4 py-3 text-slate-400">{r.subscriptionName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg ${r.adminUserEnabled ? 'text-amber-400' : 'text-emerald-400'}`}>{r.adminUserEnabled ? '⚠' : '✓'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
