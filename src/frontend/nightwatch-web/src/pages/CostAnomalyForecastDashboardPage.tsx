import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCostAnomalyForecastDashboardData } from '../hooks/useCostAnomalyForecastDashboardData';
import { PageBackButton } from '../components/PageBackButton';

interface CostAnomalyForecastDashboardPageProps {
  refreshTick: number;
}

const timeRanges = ['7d', '30d', '90d', '6m', '1y'] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMoney(value: number) {
  return `EUR ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function CostAnomalySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-3xl border border-white/10 bg-slate-900/60" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-white/10 bg-slate-950/50" />
        ))}
      </div>
      <div className="h-96 rounded-2xl border border-white/10 bg-slate-950/50" />
      <div className="h-96 rounded-2xl border border-white/10 bg-slate-950/50" />
    </div>
  );
}

export function CostAnomalyForecastDashboardPage({ refreshTick }: CostAnomalyForecastDashboardPageProps) {
  const [timeRange, setTimeRange] = useState<(typeof timeRanges)[number]>('90d');
  const { data, isLoading, loadError, hasCoreData } = useCostAnomalyForecastDashboardData(refreshTick, timeRange);
  const metrics = data?.metrics ?? [];
  const trend = data?.trend ?? [];
  const anomalies = data?.anomalies ?? [];
  const recommendations = data?.recommendations ?? [];
  const budgetForecast = data?.budgetForecast;

  if (isLoading && !hasCoreData) {
    return <CostAnomalySkeleton />;
  }

  if (loadError && !hasCoreData) {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">Live Data Unavailable</p>
        <p className="mt-2 text-sm text-rose-50/90">{loadError}</p>
      </div>
    );
  }

  if (!hasCoreData || !data || !budgetForecast) {
    return (
      <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-6 text-slate-200">
        No cost anomaly forecast data returned from the API.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <PageBackButton />
            <h2 className="mt-2 text-3xl font-black text-white">{data.title}</h2>
            <p className="mt-2 max-w-4xl text-sm text-slate-300">{data.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {timeRanges.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  timeRange === range
                    ? 'border border-cyan-300/60 bg-cyan-400/20 text-cyan-50'
                    : 'border border-white/10 bg-slate-950/40 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-100'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.key} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-black text-white">
              {metric.value === null ? 'N/A' : metric.unit === '%' ? `${metric.value.toFixed(1)}%` : `${metric.value.toLocaleString()} ${metric.unit}`}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">{metric.status}</p>
            <p className="mt-2 text-xs text-slate-300">{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-5 text-sm text-cyan-50">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Insight Callout</p>
        <p className="mt-2 leading-6">{data.insightCallout}</p>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Historical Trend & Baseline</h3>
            <p className="mt-1 text-xs text-slate-400">Daily cost trajectory against moving baseline with anomaly markers</p>
          </div>
        </div>

        <div className="h-96 w-full">
          <ResponsiveContainer>
            <ComposedChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `€${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                width={80}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                labelFormatter={(value) => new Date(value as string).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                formatter={(value, name) => {
                  const numericValue = Number(value ?? 0);
                  if (name === 'Deviation') return [`${numericValue.toFixed(1)}%`, 'Deviation from Baseline'];
                  if (name === 'Actual Cost') return [formatMoney(numericValue), 'Actual Cost'];
                  return [formatMoney(numericValue), 'Baseline'];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <ReferenceLine y={budgetForecast.dailyBurnRate} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Avg Burn', fill: '#f59e0b', fontSize: 10 }} />
              <Area type="monotone" dataKey="baselineCost" stroke="#22d3ee" fill="#22d3ee22" strokeWidth={1.5} name="Baseline" dot={false} />
              <Line type="monotone" dataKey="actualCost" stroke="#a855f7" strokeWidth={2} dot={false} name="Actual Cost" />
              <Scatter
                data={trend.filter((p) => p.isAnomaly)}
                dataKey="actualCost"
                fill="#ef4444"
                name="Anomaly"
                shape={(props: { cx?: number; cy?: number }) => (
                  <circle cx={props.cx} cy={props.cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1} opacity={0.9} />
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Red dots mark detected anomalies (&gt;12% deviation from 7-day rolling baseline). Dashed line shows 7-day average burn rate.
          {trend.length > 0 && ` Showing ${trend.length} days of data.`}
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Budget Burn Forecast</h3>
          <p className="mt-1 text-xs text-slate-400">Forward projection based on current burn velocity</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">Daily Burn Rate</p>
              <p className="mt-1 text-lg font-bold text-white">{formatMoney(budgetForecast.dailyBurnRate)}</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">Projected Month-End</p>
              <p className="mt-1 text-lg font-bold text-white">{formatMoney(budgetForecast.projectedMonthEndCost)}</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">Budget Limit</p>
              <p className="mt-1 text-lg font-bold text-white">{formatMoney(budgetForecast.budgetLimit)}</p>
            </article>
            <article className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">Forecast Variance</p>
              <p className={`mt-1 text-lg font-bold ${budgetForecast.forecastVariance > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {formatMoney(budgetForecast.forecastVariance)}
              </p>
            </article>
          </div>
          <p className="mt-3 text-xs text-cyan-200">
            Budget utilization {budgetForecast.budgetUtilizationPercent.toFixed(1)}% · Estimated exhaustion in {budgetForecast.daysToBudgetExhaustion} days
          </p>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Detected Anomalies</h3>
          <p className="mt-1 text-xs text-slate-400">Top windows sorted by deviation and cost impact</p>
          <div className="mt-3 space-y-2">
            {anomalies.map((anomaly) => (
              <article key={`${anomaly.timestamp}-${anomaly.deviationPercent}`} className="rounded-lg border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{new Date(anomaly.timestamp).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-400">Actual {formatMoney(anomaly.actualCost)} · Baseline {formatMoney(anomaly.baselineCost)}</p>
                  </div>
                  <p className={`text-xs font-semibold ${anomaly.deviationPercent >= 20 ? 'text-rose-200' : anomaly.deviationPercent >= 12 ? 'text-amber-200' : 'text-emerald-200'}`}>
                    {anomaly.severity} · +{anomaly.deviationPercent.toFixed(2)}%
                  </p>
                </div>
                <p className="mt-2 text-xs text-cyan-200">{anomaly.insight}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Recommendations</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {recommendations.map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>

        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-200">Executive Recommendation</p>
        <p className="mt-2">{data.executiveRecommendation}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-200">Operational Recommendation</p>
        <p className="mt-2">{data.operationalRecommendation}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-200">Technical Recommendation</p>
        <p className="mt-2">{data.technicalRecommendation}</p>
      </section>
    </div>
  );
}
