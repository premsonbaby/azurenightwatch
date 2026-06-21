import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCapacityPlanningDashboardData } from '../hooks/useCapacityPlanningDashboardData';
import { PageBackButton } from '../components/PageBackButton';
import type { TimeseriesPoint } from '../types/dashboard';

interface CapacityPlanningDashboardPageProps {
  refreshTick: number;
}

const timeRanges = ['7d', '30d', '90d', '6m', '1y'] as const;

function mergeSeries(history: TimeseriesPoint[], forecast: TimeseriesPoint[]) {
  return [...history.map((point) => ({ timestamp: point.timestamp, actual: point.value, forecast: null as number | null })),
    ...forecast.map((point) => ({ timestamp: point.timestamp, actual: null as number | null, forecast: point.value }))];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CapacitySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 rounded-3xl border border-white/10 bg-slate-900/60" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-white/10 bg-slate-950/50" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-80 rounded-2xl border border-white/10 bg-slate-950/50" />
        ))}
      </div>
      <div className="h-96 rounded-2xl border border-white/10 bg-slate-950/50" />
    </div>
  );
}

export function CapacityPlanningDashboardPage({ refreshTick }: CapacityPlanningDashboardPageProps) {
  const [timeRange, setTimeRange] = useState<(typeof timeRanges)[number]>('90d');
  const { data, isLoading, loadError, hasCoreData } = useCapacityPlanningDashboardData(refreshTick, timeRange);
  const metrics = data?.metrics ?? [];
  const trends = data?.trends ?? [];
  const resources = data?.resources ?? [];
  const headroomTimeline = data?.headroomTimeline ?? [];

  if (isLoading && !hasCoreData) {
    return <CapacitySkeleton />;
  }

  if (loadError && !hasCoreData) {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">Live Data Unavailable</p>
        <p className="mt-2 text-sm text-rose-50/90">{loadError}</p>
      </div>
    );
  }

  if (!hasCoreData || !data) {
    return (
      <div className="rounded-2xl border border-white/15 bg-slate-900/70 p-6 text-slate-200">
        No capacity planning data returned from the API.
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

      <section className="grid gap-4 xl:grid-cols-3">
        {trends.map((trend) => {
          const chartData = mergeSeries(trend.history, trend.forecast);
          return (
            <section key={trend.name} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">{trend.name} Utilization</h3>
                  <p className="mt-1 text-xs text-slate-400">History plus 90-day forecast</p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p>30d {trend.projected30Days.toFixed(1)}%</p>
                  <p>60d {trend.projected60Days.toFixed(1)}%</p>
                  <p>90d {trend.projected90Days.toFixed(1)}%</p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" tickFormatter={formatDate} />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip labelFormatter={(value) => new Date(value as string).toLocaleString()} />
                    <ReferenceArea y1={trend.thresholdPercent} y2={100} fill="#f97316" fillOpacity={0.08} />
                    <ReferenceLine y={trend.thresholdPercent} stroke="#f59e0b" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="actual" stroke="#22d3ee" fill="#22d3ee33" strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="forecast" stroke="#a855f7" strokeWidth={2} strokeDasharray="6 6" dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Headroom Timeline</h3>
              <p className="mt-1 text-xs text-slate-400">Estimated date each resource hits saturation</p>
            </div>
          </div>
          <div className="space-y-2">
            {headroomTimeline.map((item) => (
              <article key={`${item.resourceName}-${item.metric}`} className="rounded-lg border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.resourceName}</p>
                    <p className="text-xs text-slate-400">{item.metric}</p>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p>{item.status}</p>
                    <p>{item.estimatedHeadroomDays <= 0 ? 'No headroom' : `${item.estimatedHeadroomDays} days`}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-cyan-200">{item.saturationDate ? new Date(item.saturationDate).toLocaleDateString() : 'No saturation date predicted'}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Recommendations</h3>
              <p className="mt-1 text-xs text-slate-400">Resources sorted by waste and saturation risk</p>
            </div>
          </div>
          <div className="space-y-2">
            {resources.map((resource) => (
              <article key={`${resource.subscription}-${resource.resourceName}`} className="rounded-lg border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{resource.resourceName}</p>
                    <p className="text-xs text-slate-400">{resource.subscription} · {resource.resourceGroup}</p>
                  </div>
                  <p className={`text-xs font-semibold ${resource.status.includes('Approaching') ? 'text-amber-200' : 'text-emerald-200'}`}>{resource.status}</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
                  <p>CPU {resource.cpuCurrent.toFixed(1)}%</p>
                  <p>Memory {resource.memoryCurrent.toFixed(1)}%</p>
                  <p>Disk {resource.diskCurrent.toFixed(1)}%</p>
                  <p>Waste EUR {resource.estimatedMonthlyWaste.toFixed(2)}</p>
                </div>
                <p className="mt-2 text-xs text-cyan-200">Headroom: {resource.estimatedHeadroomDays <= 0 ? 'None' : `${resource.estimatedHeadroomDays} days`} · Saturation: {resource.saturationDate ? new Date(resource.saturationDate).toLocaleDateString() : 'Not forecasted'}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      {data.runwayForecast && data.runwayForecast.length > 0 && (
        <section className="rounded-2xl border border-orange-500/30 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">Capacity Runway — Days Until Exhaustion</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.runwayForecast.map((item, idx) => {
              const urgencyColor = item.urgencyLevel === 'Critical' ? 'border-red-500/50 bg-red-500/10 text-red-300' :
                item.urgencyLevel === 'High' ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' :
                item.urgencyLevel === 'Medium' ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300' :
                'border-blue-500/50 bg-blue-500/10 text-blue-300';
              return (
                <article key={idx} className={`rounded-xl border p-4 text-center ${urgencyColor}`}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2">{item.urgencyLevel}</p>
                  <p className="text-3xl font-black text-white">{item.daysUntilExhaustion}</p>
                  <p className="text-[10px] text-slate-400 uppercase">days</p>
                  <p className="mt-2 text-xs font-medium text-slate-200 truncate">{item.resourceName}</p>
                  <p className="text-[10px] text-slate-400">{item.metric} · {item.currentUsagePercent.toFixed(0)}%</p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Executive Recommendation</p>
        <p className="mt-2">{data.executiveRecommendation}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-200">Operational Recommendation</p>
        <p className="mt-2">{data.operationalRecommendation}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-200">Technical Recommendation</p>
        <p className="mt-2">{data.technicalRecommendation}</p>
      </section>
    </div>
  );
}