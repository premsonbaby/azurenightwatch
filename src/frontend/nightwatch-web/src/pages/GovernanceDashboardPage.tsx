import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { useNightWatchDashboardData } from '../hooks/useNightWatchDashboardData';

interface GovernanceDashboardPageProps {
  refreshTick: number;
}

export function GovernanceDashboardPage({ refreshTick }: GovernanceDashboardPageProps) {
  const { governance, isLoading, loadError, hasCoreData } = useNightWatchDashboardData(refreshTick, 'governance');
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !hasCoreData || !governance) {
    return state;
  }

  const formatMetricValue = (value: number | null, unit: string) => {
    if (value === null) {
      return 'N/A';
    }

    return unit === '%' ? `${value.toFixed(1)}%` : `${value.toLocaleString()} ${unit}`;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Compliance, drift, and ownership hygiene</h2>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Governance KPIs</h3>
          <ul className="space-y-2 text-sm text-slate-200">
            <li>Tag compliance: {governance.tagCompliancePercent}%</li>
            <li>Naming compliance: {governance.namingCompliancePercent}%</li>
            <li>Landing zone compliance: {governance.landingZoneCompliancePercent}%</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Configuration Drift</h3>
          <div className="space-y-2">
            {governance.driftAlerts.map((alert, index) => (
              <div key={`${alert}-${index}`} className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{alert}</div>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Governance Metrics</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {governance.metrics.map((metric) => (
              <article key={metric.key} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                <p className="mt-2 text-xl font-black text-white">{formatMetricValue(metric.value, metric.unit)}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-sky-200">{metric.status}</p>
                <p className="mt-2 text-xs text-slate-300">{metric.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Ownership Insights</h3>
          <div className="space-y-2 text-sm text-slate-200">
            {governance.ownershipInsights.map((insight) => (
              <article key={insight.teamName} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                <p className="font-semibold text-white">{insight.teamName}</p>
                <p>Resources: {insight.resourceCount}</p>
                <p>Unowned: {insight.unownedResources}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Lifecycle Alerts</h3>
          <div className="space-y-2 text-sm text-amber-100">
            {governance.lifecycleAlerts.map((alert, index) => (
              <div key={`${alert}-${index}`} className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-3">{alert}</div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Blueprint Comparisons</h3>
          <div className="space-y-2 text-sm text-cyan-50">
            {governance.blueprintComparisons.map((comparison, index) => (
              <div key={`${comparison}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">{comparison}</div>
            ))}
          </div>
        </section>
      </section>

      {governance.wallOfShameItems && governance.wallOfShameItems.length > 0 && (
        <section className="rounded-2xl border border-red-500/30 bg-slate-950/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">Wall of Shame — Most Violations</h3>
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">{governance.wallOfShameItems.length} resources</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.15em] text-slate-400">
                  <th className="pb-2 pr-4">Resource</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Subscription</th>
                  <th className="pb-2 pr-4">Violations</th>
                  <th className="pb-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {governance.wallOfShameItems.map((item, idx) => (
                  <tr key={item.resourceId ?? idx} className="hover:bg-white/5">
                    <td className="py-2 pr-4 font-medium text-white">{item.resourceName}</td>
                    <td className="py-2 pr-4 text-slate-400">{item.resourceType.split('/').pop()}</td>
                    <td className="py-2 pr-4 text-slate-400">{item.subscriptionName}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {item.violations.map((v, vi) => (
                          <span key={vi} className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">{v}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <span className="rounded-full bg-red-500/30 px-2 py-0.5 text-xs font-bold text-red-200">{item.violationCount}</span>
                    </td>
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