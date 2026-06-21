import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { ManagedIdentityAuditDashboard } from '../types/dashboard';

interface ManagedIdentityAuditPageProps { refreshTick: number; }

export function ManagedIdentityAuditPage({ refreshTick }: ManagedIdentityAuditPageProps) {
  const [data, setData] = useState<ManagedIdentityAuditDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getManagedIdentityAuditDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const total = data.totalUserAssigned + data.totalSystemAssigned;
  const withFedCreds = data.userAssignedIdentities.filter((i) => i.federatedCredentialCount > 0).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Managed Identity Audit</h2>
        <p className="mt-2 text-sm text-slate-300">User-assigned and system-assigned managed identities across your Azure tenant</p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {total} total identities · {data.totalUserAssigned} user-assigned · {data.totalSystemAssigned} system-assigned · {withFedCreds} with federated creds
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Identities', value: total, color: 'text-cyan-300' },
          { label: 'User-Assigned', value: data.totalUserAssigned, color: 'text-violet-400' },
          { label: 'System-Assigned', value: data.totalSystemAssigned, color: 'text-emerald-400' },
          { label: 'With Federated Creds', value: withFedCreds, color: 'text-amber-400' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 text-center">
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
            <p className="mt-1 text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Identity Split</h3>
        <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
          {total > 0 && (
            <>
              <div className="bg-violet-500 transition-all" style={{ width: `${(data.totalUserAssigned / total) * 100}%` }} title={`User-Assigned: ${data.totalUserAssigned}`} />
              <div className="bg-emerald-500 transition-all" style={{ width: `${(data.totalSystemAssigned / total) * 100}%` }} title={`System-Assigned: ${data.totalSystemAssigned}`} />
            </>
          )}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />User-Assigned ({data.totalUserAssigned})</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />System-Assigned ({data.totalSystemAssigned})</span>
        </div>
      </div>

      {data.userAssignedIdentities.length > 0 && (
        <div className="rounded-2xl border border-white/15 bg-slate-950/70 overflow-hidden">
          <div className="border-b border-white/10 bg-slate-900/40 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">User-Assigned Identities</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/20 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Subscription</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-center">Federated Creds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.userAssignedIdentities.map((id) => (
                  <tr key={id.resourceId} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{id.name}</td>
                    <td className="px-4 py-3 text-slate-400">{id.subscriptionName}</td>
                    <td className="px-4 py-3 text-slate-400">{id.location}</td>
                    <td className="px-4 py-3 text-center">
                      {id.federatedCredentialCount > 0
                        ? <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">{id.federatedCredentialCount}</span>
                        : <span className="text-slate-600">—</span>}
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
