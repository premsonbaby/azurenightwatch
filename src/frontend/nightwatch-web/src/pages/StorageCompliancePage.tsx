import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { StorageComplianceDashboard } from '../types/dashboard';

interface StorageCompliancePageProps { refreshTick: number; }

function tlsBadge(tls: string) {
  if (tls === 'TLS1_2' || tls === 'TLS1_3') return 'bg-emerald-500/20 text-emerald-300';
  if (tls === 'TLS1_1') return 'bg-amber-500/20 text-amber-300';
  return 'bg-red-500/20 text-red-300';
}

export function StorageCompliancePage({ refreshTick }: StorageCompliancePageProps) {
  const [data, setData] = useState<StorageComplianceDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getStorageComplianceDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const compliantPct = data.totalStorageAccounts > 0 ? Math.round((data.fullyCompliantCount / data.totalStorageAccounts) * 100) : 100;
  const nonCompliant = data.totalStorageAccounts - data.fullyCompliantCount;
  const pieData = [
    { name: 'Compliant', value: data.fullyCompliantCount, color: '#10b981' },
    { name: 'Non-Compliant', value: nonCompliant, color: '#f43f5e' },
  ].filter((d) => d.value > 0);

  const violations = [
    { label: 'Public Blob Access', count: data.publicAccessCount, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'HTTPS Not Enforced', count: data.httpOnlyViolationCount, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Weak TLS Version', count: data.weakTlsCount, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Shared Key Allowed', count: data.sharedKeyAllowedCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Storage Account Compliance</h2>
        <p className="mt-2 text-sm text-slate-300">Public access, HTTPS enforcement, TLS version, and shared key access across all storage accounts</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalStorageAccounts} accounts · {data.fullyCompliantCount} compliant · {nonCompliant} non-compliant
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 flex flex-col items-center justify-center">
          <p className={`text-6xl font-black ${compliantPct >= 80 ? 'text-emerald-400' : compliantPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{compliantPct}%</p>
          <p className="mt-2 text-sm text-slate-400">Fully Compliant</p>
          <p className="mt-1 text-xs text-slate-500">{data.fullyCompliantCount} of {data.totalStorageAccounts} accounts</p>
          {pieData.length > 0 && (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Violations Breakdown</h3>
          <div className="grid grid-cols-2 gap-3">
            {violations.map((v) => (
              <div key={v.label} className={`rounded-lg p-3 ${v.bg} border border-slate-700`}>
                <p className={`text-2xl font-bold ${v.color}`}>{v.count}</p>
                <p className="mt-0.5 text-xs text-slate-400">{v.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.storageAccounts.length > 0 && (
        <div className="rounded-2xl border border-white/15 bg-slate-950/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Public Access</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">HTTPS Only</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">TLS</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Shared Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.storageAccounts.map((s) => (
                  <tr key={s.resourceId} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                    <td className="px-4 py-3 text-slate-400">{s.subscriptionName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base ${s.publicBlobAccessEnabled ? 'text-red-400' : 'text-emerald-400'}`}>{s.publicBlobAccessEnabled ? '✗' : '✓'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base ${s.httpsOnly ? 'text-emerald-400' : 'text-red-400'}`}>{s.httpsOnly ? '✓' : '✗'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tlsBadge(s.minTlsVersion)}`}>{s.minTlsVersion || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base ${s.allowSharedKeyAccess ? 'text-amber-400' : 'text-emerald-400'}`}>{s.allowSharedKeyAccess ? '⚠' : '✓'}</span>
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
