import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { DatabaseHealthDashboard } from '../types/dashboard';

interface DatabaseHealthPageProps { refreshTick: number; }

const ENGINE_COLORS: Record<string, string> = {
  'SQL Database': '#06b6d4',
  'MySQL': '#8b5cf6',
  'PostgreSQL': '#10b981',
  'Cosmos DB': '#f59e0b',
  'Elastic Pool': '#f43f5e',
};

function engineColor(engine: string) {
  return ENGINE_COLORS[engine] ?? '#64748b';
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'online' || s === 'running') return 'bg-emerald-500/20 text-emerald-300';
  if (s === 'stopped' || s === 'paused') return 'bg-amber-500/20 text-amber-300';
  return 'bg-red-500/20 text-red-300';
}

export function DatabaseHealthPage({ refreshTick }: DatabaseHealthPageProps) {
  const [data, setData] = useState<DatabaseHealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getDatabaseHealthDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const engineData = [
    { name: 'SQL Database', count: data.sqlCount },
    { name: 'MySQL', count: data.mySqlCount },
    { name: 'PostgreSQL', count: data.postgreSqlCount },
    { name: 'Cosmos DB', count: data.cosmosDbCount },
    { name: 'Elastic Pool', count: data.elasticPoolCount },
  ].filter((e) => e.count > 0);

  const kpis = [
    { label: 'Total Databases', value: data.totalDatabases, color: 'text-cyan-300' },
    { label: 'Running', value: data.runningDatabases, color: 'text-emerald-400' },
    { label: 'Stopped', value: data.stoppedDatabases, color: 'text-amber-400' },
    { label: 'Engine Types', value: engineData.length, color: 'text-violet-400' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Database Health</h2>
        <p className="mt-2 text-sm text-slate-300">Azure database inventory: SQL, MySQL, PostgreSQL, Cosmos DB, Elastic Pools</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalDatabases} total · {data.runningDatabases} running · {data.stoppedDatabases} stopped · {engineData.length} engine types
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

      {engineData.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Distribution by Engine</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={engineData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {engineData.map((e) => (
                  <Cell key={e.name} fill={engineColor(e.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.databases.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Engine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Tier / SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.databases.map((db) => (
                  <tr key={db.resourceId} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{db.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: engineColor(db.dbEngine) }} />
                        <span className="text-slate-300">{db.dbEngine}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{db.subscriptionName}</td>
                    <td className="px-4 py-3 text-slate-400">{db.location}</td>
                    <td className="px-4 py-3 text-slate-300">{db.tier || db.sku || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(db.status)}`}>{db.status}</span>
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
