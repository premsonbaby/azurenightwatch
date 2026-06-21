import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { MessagingHealthDashboard } from '../types/dashboard';

interface MessagingHealthPageProps { refreshTick: number; }

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'running') return 'bg-emerald-500/20 text-emerald-300';
  return 'bg-amber-500/20 text-amber-300';
}

const SKU_COLORS: Record<string, string> = {
  Basic: '#64748b',
  Standard: '#06b6d4',
  Premium: '#8b5cf6',
};

export function MessagingHealthPage({ refreshTick }: MessagingHealthPageProps) {
  const [data, setData] = useState<MessagingHealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'servicebus' | 'eventhub'>('servicebus');

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getMessagingHealthDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Messaging Health</h2>
        <p className="mt-2 text-sm text-slate-300">Service Bus and Event Hub namespaces across your Azure tenant</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalServiceBusNamespaces} service bus · {data.totalEventHubNamespaces} event hubs
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
          <p className="text-4xl font-black text-cyan-300">{data.totalServiceBusNamespaces}</p>
          <p className="mt-1 text-sm text-slate-400">Service Bus Namespaces</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
          <p className="text-4xl font-black text-violet-400">{data.totalEventHubNamespaces}</p>
          <p className="mt-1 text-sm text-slate-400">Event Hub Namespaces</p>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl bg-slate-800/50 border border-slate-700 p-1">
        <button onClick={() => setTab('servicebus')}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${tab === 'servicebus' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}>
          Service Bus ({data.totalServiceBusNamespaces})
        </button>
        <button onClick={() => setTab('eventhub')}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${tab === 'eventhub' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-white'}`}>
          Event Hubs ({data.totalEventHubNamespaces})
        </button>
      </div>

      {tab === 'servicebus' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          {data.serviceBusNamespaces.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No Service Bus namespaces found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Namespace</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.serviceBusNamespaces.map((ns) => (
                    <tr key={ns.resourceId} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{ns.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${SKU_COLORS[ns.sku] ?? '#64748b'}25`, color: SKU_COLORS[ns.sku] ?? '#94a3b8' }}>{ns.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{ns.subscriptionName}</td>
                      <td className="px-4 py-3 text-slate-400">{ns.location}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(ns.status)}`}>{ns.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'eventhub' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          {data.eventHubNamespaces.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No Event Hub namespaces found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Namespace</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Location</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Throughput Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.eventHubNamespaces.map((ns) => (
                    <tr key={ns.resourceId} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{ns.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${SKU_COLORS[ns.sku] ?? '#64748b'}25`, color: SKU_COLORS[ns.sku] ?? '#94a3b8' }}>{ns.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{ns.subscriptionName}</td>
                      <td className="px-4 py-3 text-slate-400">{ns.location}</td>
                      <td className="px-4 py-3 text-right text-cyan-300 font-bold">{ns.throughputUnits}</td>
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
