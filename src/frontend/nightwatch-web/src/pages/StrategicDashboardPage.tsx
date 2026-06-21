import { Link } from 'react-router-dom';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { useStrategicDashboardData } from '../hooks/useStrategicDashboardData';

interface StrategicDashboardPageProps {
  refreshTick: number;
  dashboardKey: string;
}

export function StrategicDashboardPage({ refreshTick, dashboardKey }: StrategicDashboardPageProps) {
  const { data, isLoading, loadError, hasCoreData } = useStrategicDashboardData(refreshTick, dashboardKey);
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;

  if (state.props.children !== undefined || !hasCoreData || !data) {
    return state;
  }

  const formatMetricValue = (value: number | null, unit: string) => {
    if (value === null) {
      return 'N/A';
    }

    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }

    if (unit.toLowerCase() === 'eur') {
      return `EUR ${value.toLocaleString()}`;
    }

    return `${value.toLocaleString()} ${unit}`;
  };

  if (dashboardKey === 'ri-savings') {
    const opportunities = data.riSavingsOpportunities ?? [];
    const currentMonthCostMetric = data.metrics.find((metric) => metric.key === 'cost' || metric.label.toLowerCase().includes('current month cost'));
    const currentMonthCost = opportunities.length > 0
      ? opportunities.reduce((sum, item) => sum + Math.max(0, item.monthlyCost), 0)
      : Math.max(0, currentMonthCostMetric?.value ?? 0);
    const estimatedMonthlySavings = opportunities.length > 0
      ? opportunities.reduce((sum, item) => sum + Math.max(0, item.potentialMonthlySavings), 0)
      : 0;
    const evidenceRows = opportunities.map((item, index) => ({
      id: `${item.resourceId}-${index}`,
      subscription: item.subscriptionName || 'Selected subscription',
      recommendedOption: item.recommendedOption,
      contractModel: item.contractModel,
      resource: item.resourceName,
      resourceType: item.resourceType,
      sku: item.sku,
      pricingAssumption: item.pricingAssumption,
      monthlyCost: item.monthlyCost,
      potentialSavings: item.potentialMonthlySavings,
      pricingModel: item.pricingModel,
      recommendation: item.recommendation,
    }));

    const normalizedCurrentMonthCost = Math.round(currentMonthCost * 100) / 100;
    const normalizedEstimatedSavings = Math.round(estimatedMonthlySavings * 100) / 100;
    const savingsPercent = normalizedCurrentMonthCost > 0
      ? (normalizedEstimatedSavings / normalizedCurrentMonthCost) * 100
      : 0;
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
          <div className="mb-2">
            <PageBackButton />
          </div>
          <h2 className="mt-2 text-3xl font-black text-white">Reserved Instance & Savings Plan Optimization</h2>
          <p className="mt-2 text-sm text-slate-300">Estimated monthly savings opportunity if commitment discounts are enabled.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-emerald-200">Estimated Monthly Savings</p>
            <p className="mt-2 text-4xl font-black text-emerald-100">EUR {normalizedEstimatedSavings.toLocaleString()}</p>
            <p className="mt-2 text-xs text-emerald-50/90">Approx. {savingsPercent.toFixed(1)}% of in-scope monthly compute spend.</p>
          </article>

          <article className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-cyan-200">Current Monthly Cost In Scope</p>
            <p className="mt-2 text-4xl font-black text-cyan-100">EUR {normalizedCurrentMonthCost.toLocaleString()}</p>
            <p className="mt-2 text-xs text-cyan-50/90">Computed from month-to-date resource-level cost usage.</p>
          </article>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Savings Estimate</h3>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-900/90 text-xs uppercase tracking-[0.12em] text-slate-300">
                <tr>
                  <th className="px-3 py-2">Subscription</th>
                  <th className="px-3 py-2">Recommended Option</th>
                  <th className="px-3 py-2">Contract</th>
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Pricing Model</th>
                  <th className="px-3 py-2">Monthly Cost</th>
                  <th className="px-3 py-2">Est. Savings</th>
                  <th className="px-3 py-2">Assumption</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-100">
                {evidenceRows.length > 0 ? evidenceRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{row.subscription}</td>
                    <td className="px-3 py-2">{row.recommendedOption}</td>
                    <td className="px-3 py-2">{row.contractModel}</td>
                    <td className="px-3 py-2">{row.resource}</td>
                    <td className="px-3 py-2">{row.resourceType}</td>
                    <td className="px-3 py-2">{row.sku}</td>
                    <td className="px-3 py-2">{row.pricingModel}</td>
                    <td className="px-3 py-2">EUR {row.monthlyCost.toLocaleString()}</td>
                    <td className="px-3 py-2">EUR {row.potentialSavings.toLocaleString()}</td>
                    <td className="px-3 py-2">{row.pricingAssumption}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-3 py-3 text-slate-300" colSpan={10}>No resource-level cost records were returned for this cycle.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <div className="mb-2">
          <PageBackButton />
        </div>
        <div>
          <h2 className="mt-2 text-3xl font-black text-white">{data.title}</h2>
          <p className="mt-2 text-sm text-slate-300">{data.summary}</p>
          <p className="mt-2 text-xs text-slate-400">Priority: {data.priority}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <article key={metric.key} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-black text-white">{formatMetricValue(metric.value, metric.unit)}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">{metric.status}</p>
            <p className="mt-2 text-xs text-slate-300">{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Current Signals</h3>
          <div className="space-y-2 text-sm text-slate-200">
            {data.signals.map((signal, index) => (
              <div key={`${signal}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">{signal}</div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Recommended Actions</h3>
          <div className="space-y-2 text-sm text-emerald-100">
            {data.recommendations.map((recommendation, index) => (
              <div key={`${recommendation}-${index}`} className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-3">{recommendation}</div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Actionable Details</h3>
        <div className="space-y-3">
          {data.actionableDetails.map((item, index) => (
            <article key={`${item.issueTitle}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <p className="text-sm font-semibold text-white">{item.issueTitle}</p>
              <p className="mt-1 text-xs text-slate-300">Severity: {item.severity} · Risk Score: {item.riskScore.toFixed(1)} · Confidence: {(item.confidenceScore * 100).toFixed(0)}%</p>
              <p className="mt-2 text-xs text-slate-300">{item.impactAnalysis}</p>
              <p className="mt-1 text-xs text-cyan-200">Root Cause: {item.rootCauseExplanation}</p>
              <p className="mt-1 text-xs text-emerald-200">Recommended: {item.recommendedRemediation}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
                {item.correlatedResources.slice(0, 3).map((resource) => (
                  <Link key={resource} to={`/resource-deep-dive?resourceId=${encodeURIComponent(resource)}`} className="rounded border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Drill-down: {resource.split('/').pop()}</Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Historical Intelligence</h3>
        <div className="space-y-2 text-xs text-slate-300">
          <p>{data.historicalIntelligence.baselineComparison}</p>
          <p>{data.historicalIntelligence.trendDeviation}</p>
          <p>{data.historicalIntelligence.riskEvolution}</p>
          <p>{data.historicalIntelligence.predictedOutcomeIfIgnored}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 text-xs text-slate-300">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Auditability & Traceability</h3>
        <p><span className="text-cyan-200">Why:</span> {data.auditEvidence.reason}</p>
        <p><span className="text-cyan-200">Sources:</span> {data.auditEvidence.dataSources}</p>
        <p><span className="text-cyan-200">Evidence:</span> {data.auditEvidence.historicalEvidence}</p>
        <p><span className="text-cyan-200">Correlation:</span> {data.auditEvidence.correlationLogic}</p>
        <p><span className="text-cyan-200">Telemetry:</span> {data.auditEvidence.telemetryReferences}</p>
      </section>
    </div>
  );
}
