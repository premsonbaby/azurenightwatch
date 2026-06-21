import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { useStrategicDashboardData } from '../hooks/useStrategicDashboardData';
import type { TimeseriesPoint } from '../types/dashboard';

interface OperationalForecastDashboardPageProps {
  refreshTick: number;
  dashboardKey: string;
  moduleLabel: string;
}

const horizonOptions = ['7d', '30d', '90d', '6m', '1y'] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMetricValue(value: number | null, unit: string) {
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
}

function formatSeverityLabel(value: string | number) {
  if (typeof value === 'number') {
    return ['Low', 'Medium', 'High', 'Critical'][value] ?? String(value);
  }

  if (!value) {
    return 'Unknown';
  }

  return value;
}

function deriveWorkloadTier(severity: string | number, confidence: number) {
  const normalizedSeverity = formatSeverityLabel(severity).toLowerCase();
  if (normalizedSeverity === 'critical' || confidence >= 0.9) {
    return 'Tier 1';
  }

  if (normalizedSeverity === 'high' || confidence >= 0.8) {
    return 'Tier 2';
  }

  return 'Tier 3';
}

function selectHistoricalSeries(
  horizon: (typeof horizonOptions)[number],
  trend7Days: TimeseriesPoint[],
  trend30Days: TimeseriesPoint[],
  trend90Days: TimeseriesPoint[],
  trend6Months: TimeseriesPoint[],
  trend12Months: TimeseriesPoint[],
) {
  switch (horizon) {
    case '7d':
      return trend7Days;
    case '30d':
      return trend30Days;
    case '90d':
      return trend90Days;
    case '6m':
      return trend6Months;
    case '1y':
      return trend12Months;
    default:
      return trend90Days;
  }
}

export function OperationalForecastDashboardPage({
  refreshTick,
  dashboardKey,
  moduleLabel,
}: OperationalForecastDashboardPageProps) {
  const [horizon, setHorizon] = useState<(typeof horizonOptions)[number]>('90d');
  const previousBackupMetricsRef = useRef<Map<string, number>>(new Map());
  const [backupMetricChanges, setBackupMetricChanges] = useState<Array<{ label: string; delta: number; unit: string }>>([]);
  const { data, isLoading, loadError, hasCoreData } = useStrategicDashboardData(refreshTick, dashboardKey);
  const metrics = data?.metrics ?? [];
  const actionable = data?.actionableDetails ?? [];
  const recommendations = data?.recommendations ?? [];
  const historical = data?.historicalIntelligence;
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;

  const selectedHistorical = selectHistoricalSeries(
    horizon,
    historical?.trend7Days ?? [],
    historical?.trend30Days ?? [],
    historical?.trend90Days ?? [],
    historical?.trend6Months ?? [],
    historical?.trend12Months ?? [],
  );

  const chartData = selectedHistorical.map((point) => ({
    timestamp: point.timestamp,
    value: point.value,
  }));

  useEffect(() => {
    if (dashboardKey !== 'backup-health' || metrics.length === 0) {
      return;
    }

    const current = new Map<string, number>();
    const changes: Array<{ label: string; delta: number; unit: string }> = [];
    for (const metric of metrics) {
      if (metric.value === null) {
        continue;
      }

      current.set(metric.key, metric.value);
      const previousValue = previousBackupMetricsRef.current.get(metric.key);
      if (previousValue === undefined) {
        continue;
      }

      const delta = metric.value - previousValue;
      if (Math.abs(delta) >= 0.01) {
        changes.push({
          label: metric.label,
          delta,
          unit: metric.unit,
        });
      }
    }

    setBackupMetricChanges(changes.slice(0, 5));
    previousBackupMetricsRef.current = current;
  }, [dashboardKey, data?.generatedAt, metrics]);

  if (state.props.children !== undefined || !hasCoreData || !data) {
    return state;
  }

  if (dashboardKey === 'backup-health') {
    const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
    const keyMetrics = [
      metricByKey.get('backupSuccessRate'),
      metricByKey.get('protectedCoverage'),
      metricByKey.get('rpoBreachCount'),
      metricByKey.get('retentionCompliance'),
      metricByKey.get('restoreReadiness'),
    ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

    const atRiskResources = actionable
      .flatMap((item) =>
        item.correlatedResources.map((resource) => ({
          resource,
          severity: item.severity,
          tier: deriveWorkloadTier(item.severity as unknown as string | number, item.confidenceScore),
          confidence: item.confidenceScore,
          action: item.recommendedRemediation,
        })),
      )
      .slice(0, 10);

    const topRisks = data.structuredSummary?.topRisks?.slice(0, 3) ?? [];
    const topActions = actionable.slice(0, 5);

    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
          <div className="mb-2">
            <PageBackButton />
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="mt-2 text-3xl font-black text-white">{moduleLabel}</h2>
              <p className="mt-2 text-sm text-slate-300">{data.summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${data.priority === 'Critical' ? 'border border-rose-300/40 bg-rose-500/20 text-rose-100' : data.priority === 'High' ? 'border border-amber-300/40 bg-amber-500/20 text-amber-100' : 'border border-emerald-300/40 bg-emerald-500/20 text-emerald-100'}`}>
                {data.priority} Priority
              </span>
              <div className="flex flex-wrap gap-2">
                {horizonOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setHorizon(option)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      option === horizon
                        ? 'border border-cyan-300/60 bg-cyan-400/20 text-cyan-50'
                        : 'border border-white/10 bg-slate-950/40 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-100'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {keyMetrics.map((metric) => (
            <article key={metric.key} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{formatMetricValue(metric.value, metric.unit)}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">{metric.status}</p>
              <p className="mt-2 text-xs text-slate-300">{metric.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Do Now (Top Actions)</h3>
          <div className="space-y-2 text-sm text-slate-200">
            {topActions.map((item, index) => (
              <article key={`${item.issueTitle}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                <p className="font-semibold text-white">{item.issueTitle}</p>
                <p className="mt-1 text-xs text-slate-300">Owner: {item.responsibleOwnerTeam} · Severity: {formatSeverityLabel(item.severity as unknown as string | number)}</p>
                <p className="mt-2 text-xs text-emerald-200">Action: {item.recommendedRemediation}</p>
              </article>
            ))}
          </div>
        </section>

        {topRisks.length > 0 && (
          <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Top Risks</h3>
            <div className="space-y-1 text-xs text-slate-300">
              {topRisks.map((risk, index) => (
                <p key={`${risk}-${index}`}>{index + 1}. {risk}</p>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">What Changed Since Last Refresh</h3>
          {backupMetricChanges.length === 0 ? (
            <p className="text-sm text-slate-300">No major metric shift since the previous refresh.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {backupMetricChanges.map((change, index) => (
                <article key={`${change.label}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-200">
                  <p className="font-semibold text-white">{change.label}</p>
                  <p className={`mt-1 ${change.delta >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                    {change.delta >= 0 ? '+' : ''}{change.delta.toFixed(change.unit === '%' ? 1 : 0)} {change.unit}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Recovery Readiness Trend</h3>
              <p className="mt-1 text-xs text-slate-400">Restore readiness score over selected horizon: {horizon}</p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" stroke="#94a3b8" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} domain={[0, 100]} width={45} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                  labelFormatter={(value) => new Date(value as string).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Readiness Score']}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee22" strokeWidth={1.5} name="Readiness" dot={false} />
                <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={false} name="Trend" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {historical && (
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              {historical.baselineComparison && <p>{historical.baselineComparison}</p>}
              {historical.trendDeviation && <p>{historical.trendDeviation}</p>}
              {historical.riskEvolution && <p>{historical.riskEvolution}</p>}
              {historical.predictedOutcomeIfIgnored && <p className="text-amber-300/80">{historical.predictedOutcomeIfIgnored}</p>}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Protected Workloads Requiring Action</h3>
          <p className="mb-3 text-xs text-slate-400">Backup-protected resources with active recovery risk — derived from vault inventory</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {atRiskResources.map((item, index) => (
                  <tr key={`${item.resource}-${index}`} className="border-b border-white/5">
                    <td className="px-3 py-2 text-cyan-200">{item.resource.split('/').pop() ?? item.resource}</td>
                    <td className="px-3 py-2 text-slate-300">{item.tier}</td>
                    <td className="px-3 py-2 text-slate-300">{formatSeverityLabel(item.severity as unknown as string | number)}</td>
                    <td className="px-3 py-2 text-slate-300">{(item.confidence * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-slate-300">{item.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Recommendations</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-200">Executive Recommendation</p>
          <p className="mt-2">{data.executiveRecommendation}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-200">Operational Recommendation</p>
          <p className="mt-2">{data.operationalRecommendation}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-200">Technical Recommendation</p>
          <p className="mt-2">{data.technicalRecommendation}</p>
        </section>

        {data.signals.length > 0 && (
          <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live Signal Notes</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {data.signals.map((note, index) => (
                <li key={index} className="flex gap-2"><span className="text-cyan-500">·</span>{note}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <div className="mb-2">
          <PageBackButton />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="mt-2 text-3xl font-black text-white">{moduleLabel}</h2>
            <p className="mt-2 text-sm text-slate-300">{data.summary}</p>
            <p className="mt-2 text-xs text-slate-400">Priority: {data.priority}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {horizonOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setHorizon(option)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  option === horizon
                    ? 'border border-cyan-300/60 bg-cyan-400/20 text-cyan-50'
                    : 'border border-white/10 bg-slate-950/40 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-100'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.key} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-black text-white">{formatMetricValue(metric.value, metric.unit)}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">{metric.status}</p>
            <p className="mt-2 text-xs text-slate-300">{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Historical Trend Analysis</h3>
        <p className="mb-3 text-xs text-slate-400">Selected horizon: {horizon}</p>
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" tickFormatter={formatDate} />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                labelFormatter={(value) => new Date(value as string).toLocaleString()}
                formatter={(value) => [Number(value).toFixed(2), 'Risk/Cost Signal']}
              />
              <Legend />
              <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee33" name="Historical" />
              <Line type="monotone" dataKey="value" stroke="#a855f7" dot={false} name="Trend" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 space-y-1 text-xs text-slate-300">
          <p>{historical?.baselineComparison}</p>
          <p>{historical?.trendDeviation}</p>
          <p>{historical?.riskEvolution}</p>
          <p>{historical?.predictedOutcomeIfIgnored}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Actionable Details</h3>
          <div className="space-y-3">
            {actionable.map((item, index) => (
              <article key={`${item.issueTitle}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                <p className="text-sm font-semibold text-white">{item.issueTitle}</p>
                <p className="mt-1 text-xs text-slate-300">Severity: {formatSeverityLabel(item.severity as unknown as string | number)} · Risk Score: {item.riskScore.toFixed(1)} · Confidence: {(item.confidenceScore * 100).toFixed(0)}%</p>
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
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Recommendations</h3>
          <div className="space-y-2 text-sm text-emerald-100">
            {recommendations.map((recommendation, index) => (
              <div key={`${recommendation}-${index}`} className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-3">{recommendation}</div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/80 p-3 text-xs text-slate-300">
            <p className="text-slate-200">Executive Recommendation</p>
            <p className="mt-1">{data.executiveRecommendation}</p>
            <p className="mt-3 text-slate-200">Operational Recommendation</p>
            <p className="mt-1">{data.operationalRecommendation}</p>
            <p className="mt-3 text-slate-200">Technical Recommendation</p>
            <p className="mt-1">{data.technicalRecommendation}</p>
          </div>
        </section>
      </section>
    </div>
  );
}
