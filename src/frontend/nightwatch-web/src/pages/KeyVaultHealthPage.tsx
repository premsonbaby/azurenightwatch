import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { KeyVaultHealthDashboard } from '../types/dashboard';

interface KeyVaultHealthPageProps { refreshTick: number; }

export function KeyVaultHealthPage({ refreshTick }: KeyVaultHealthPageProps) {
  const [data, setData] = useState<KeyVaultHealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getKeyVaultHealthDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const accessPieData = [
    { name: 'RBAC Model', value: data.rbacModelCount, color: '#10b981' },
    { name: 'Access Policy', value: data.accessPolicyModelCount, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  const riskKpis = [
    { label: 'Soft Delete Disabled', value: data.softDeleteDisabledCount, color: data.softDeleteDisabledCount > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Purge Protection Off', value: data.purgeProtectionDisabledCount, color: data.purgeProtectionDisabledCount > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Access Policy Model', value: data.accessPolicyModelCount, color: data.accessPolicyModelCount > 0 ? 'text-amber-400' : 'text-emerald-400' },
    { label: 'RBAC Model', value: data.rbacModelCount, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Key Vault Health</h2>
        <p className="mt-2 text-sm text-slate-300">Security posture of Azure Key Vault instances — soft-delete, purge protection, access model</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalVaults} total vaults · {data.rbacModelCount} RBAC · {data.accessPolicyModelCount} access policy
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center sm:col-span-1">
          <p className="text-3xl font-black text-cyan-300">{data.totalVaults}</p>
          <p className="mt-1 text-xs text-slate-400">Total Vaults</p>
        </div>
        {riskKpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center">
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
            <p className="mt-1 text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {accessPieData.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Access Model Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={accessPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {accessPieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-300">Security Posture Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Soft Delete Enabled', pass: data.totalVaults - data.softDeleteDisabledCount, fail: data.softDeleteDisabledCount },
              { label: 'Purge Protection', pass: data.totalVaults - data.purgeProtectionDisabledCount, fail: data.purgeProtectionDisabledCount },
              { label: 'RBAC Access Model', pass: data.rbacModelCount, fail: data.accessPolicyModelCount },
            ].map((item) => {
              const total = item.pass + item.fail;
              const pct = total > 0 ? Math.round((item.pass / total) * 100) : 100;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>{item.label}</span>
                    <span className={pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700">
                    <div className={`h-2 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {data.vaults.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Vault Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">SKU</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Soft Delete</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Purge Protection</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Access Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.vaults.map((v) => (
                  <tr key={v.resourceId} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{v.name}</td>
                    <td className="px-4 py-3 text-slate-400">{v.subscriptionName}</td>
                    <td className="px-4 py-3 text-slate-300">{v.sku}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg ${v.softDeleteEnabled ? 'text-emerald-400' : 'text-red-400'}`}>{v.softDeleteEnabled ? '✓' : '✗'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg ${v.purgeProtectionEnabled ? 'text-emerald-400' : 'text-red-400'}`}>{v.purgeProtectionEnabled ? '✓' : '✗'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.accessModel === 'rbac' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{v.accessModel}</span>
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
