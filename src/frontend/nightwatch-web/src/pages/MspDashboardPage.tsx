import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { useNightWatchDashboardData } from '../hooks/useNightWatchDashboardData';

interface MspDashboardPageProps {
  refreshTick: number;
}

export function MspDashboardPage({ refreshTick }: MspDashboardPageProps) {
  const { tenants, isLoading, loadError, hasCoreData } = useNightWatchDashboardData(refreshTick, 'msp');
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !hasCoreData) {
    return state;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Cross-tenant overview and customer segmentation</h2>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">MSP Overview Dashboard</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <article key={tenant.tenantId} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <p className="text-sm font-semibold text-white">{tenant.tenantName}</p>
              <p className="text-xs text-slate-300">Subscriptions: {tenant.subscriptionCount}</p>
              <p className="text-xs text-slate-300">Overall risk: {tenant.overallRiskScore}%</p>
              <p className="text-xs text-rose-200">Critical alerts: {tenant.activeCriticalAlerts}</p>
              <p className="mt-2 inline-block rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-fuchsia-100">{tenant.segment}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Tenant Health Heatmap</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.15em] text-slate-400">
                <th className="pb-2 pr-6">Tenant</th>
                <th className="pb-2 pr-4 text-center">Security</th>
                <th className="pb-2 pr-4 text-center">Cost</th>
                <th className="pb-2 pr-4 text-center">Performance</th>
                <th className="pb-2 pr-4 text-center">Governance</th>
                <th className="pb-2 text-center">Overall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.map((tenant) => {
                const scoreCell = (val: number) => {
                  const color = val >= 80 ? 'bg-green-500/20 text-green-300' : val >= 60 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300';
                  return <td className="py-2 pr-4 text-center"><span className={`rounded px-2 py-0.5 text-xs font-bold ${color}`}>{val?.toFixed(0) ?? '—'}</span></td>;
                };
                return (
                  <tr key={tenant.tenantId} className="hover:bg-white/5">
                    <td className="py-2 pr-6">
                      <p className="font-medium text-white">{tenant.tenantName}</p>
                      <p className="text-[10px] text-slate-400">{tenant.subscriptionCount} subs · {tenant.segment}</p>
                    </td>
                    {scoreCell(tenant.securityScore)}
                    {scoreCell(tenant.costScore)}
                    {scoreCell(tenant.performanceScore)}
                    {scoreCell(tenant.governanceScore)}
                    {scoreCell(tenant.overallRiskScore)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}