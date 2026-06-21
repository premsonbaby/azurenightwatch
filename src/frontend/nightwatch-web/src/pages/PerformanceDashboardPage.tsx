import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { useNightWatchDashboardData } from '../hooks/useNightWatchDashboardData';

interface PerformanceDashboardPageProps {
  refreshTick: number;
}

export function PerformanceDashboardPage({ refreshTick }: PerformanceDashboardPageProps) {
  const { performance, isLoading, loadError, hasCoreData } = useNightWatchDashboardData(refreshTick, 'performance');
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !hasCoreData || !performance) {
    return state;
  }

  const chartData = performance.cpuAnomalies.slice(0, 12).map((point, index) => ({
    idx: index,
    cpu: point.value,
    latency: performance.diskLatencyMs[index]?.value ?? 0,
    network: performance.networkBottleneckScore[index]?.value ?? 0,
  }));

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
        <h2 className="mt-2 text-3xl font-black text-white">Anomalies, dependencies, and outage risk</h2>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Resource Trend Analysis</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="idx" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#22d3ee" strokeWidth={2} />
                <Line type="monotone" dataKey="latency" stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="network" stroke="#c084fc" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-amber-200">SLA Risk Prediction: {performance.slaRiskScore}%</p>
          <div className="mt-3 space-y-2">
            {performance.outagePredictions.map((prediction, index) => (
              <div key={`${prediction}-${index}`} className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-50">{prediction}</div>
            ))}
          </div>
        </section>

        <RelationshipGraph nodes={performance.dependencyNodes} edges={performance.dependencyEdges} title="Resource Dependency Mapping" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 xl:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Performance Metrics</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {performance.metrics.map((metric) => (
              <article key={metric.key} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                <p className="mt-2 text-xl font-black text-white">{formatMetricValue(metric.value, metric.unit)}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-cyan-200">{metric.status}</p>
                <p className="mt-2 text-xs text-slate-300">{metric.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Service Health Signals</h3>
          <div className="space-y-2 text-sm text-slate-200">
            {performance.serviceHealthSignals.map((signal, index) => (
              <div key={`${signal}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">{signal}</div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Regional Outage Impacts</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {performance.regionalOutageImpacts.map((impact, index) => (
            <div key={`${impact}-${index}`} className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-50">{impact}</div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[auto_1fr]">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-6 flex flex-col items-center justify-center min-w-[200px]">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200 text-center">Fragility Index</h3>
          <div className="relative flex h-32 w-32 items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={performance.fragilityIndex <= 20 ? '#22c55e' : performance.fragilityIndex <= 40 ? '#84cc16' : performance.fragilityIndex <= 60 ? '#eab308' : performance.fragilityIndex <= 80 ? '#f97316' : '#ef4444'}
                strokeWidth="12"
                strokeDasharray={`${(performance.fragilityIndex / 100) * 314} 314`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="text-center">
              <p className="text-3xl font-black text-white">{performance.fragilityIndex}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">/100</p>
            </div>
          </div>
          <p className="mt-3 text-center font-semibold text-white">{performance.fragilityRating}</p>
          <p className="mt-1 text-center text-xs text-slate-400">System Fragility</p>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Fragility Drivers</h3>
          <div className="space-y-2">
            {(performance.fragilityDrivers ?? []).map((driver, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-orange-300/20 bg-orange-500/10 p-3 text-sm text-orange-100">
                <span className="text-orange-400">⚠</span>
                {driver}
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}