import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { useNightWatchDashboardData } from '../hooks/useNightWatchDashboardData';

interface CostDashboardPageProps {
  refreshTick: number;
}

export function CostDashboardPage({ refreshTick }: CostDashboardPageProps) {
  const { cost, isLoading, loadError, hasCoreData } = useNightWatchDashboardData(refreshTick, 'cost');
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !hasCoreData || !cost) {
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
        <h2 className="mt-2 text-3xl font-black text-white">Forecasting, anomalies, and savings opportunities</h2>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Cost Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <AreaChart data={cost.costTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" stroke="#94a3b8" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                <YAxis stroke="#94a3b8" />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Optimization Summary</h3>
          <p className="text-sm text-slate-300">Current Month: EUR {cost.currentMonthCost.toLocaleString()}</p>
          <p className="text-sm text-slate-300">Predicted Next Month: EUR {cost.predictedNextMonthCost.toLocaleString()}</p>
          <p className="mt-1 text-sm text-slate-300">Carbon Footprint: {cost.carbonFootprintKgCo2.toLocaleString()} kg CO2</p>
          <div className="mt-4 space-y-3">
            {cost.recommendations.map((item, index) => (
              <article key={`${item.title}-${index}`} className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-3">
                <p className="text-sm font-semibold text-emerald-100">{item.title}</p>
                <p className="text-xs text-emerald-50/90">{item.description}</p>
                <p className="mt-2 text-xs text-emerald-100">Estimated savings: EUR {item.estimatedMonthlySavings.toLocaleString()}/month</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Cost Metrics</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {cost.metrics.map((metric) => (
              <article key={metric.key} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                <p className="mt-2 text-xl font-black text-white">{formatMetricValue(metric.value, metric.unit)}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-emerald-200">{metric.status}</p>
                <p className="mt-2 text-xs text-slate-300">{metric.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Cost Spike Alerts</h3>
          <div className="space-y-2 text-sm text-rose-100">
            {cost.costSpikeAlerts.map((alert, index) => (
              <div key={`${alert}-${index}`} className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3">{alert}</div>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Reserved Instance Recommendations</h3>
          <div className="space-y-2 text-sm text-emerald-50">
            {cost.reservedInstanceRecommendations.map((recommendation, index) => (
              <div key={`${recommendation}-${index}`} className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-3">{recommendation}</div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Savings Plan Suggestions</h3>
          <div className="space-y-2 text-sm text-cyan-50">
            {cost.savingsPlanSuggestions.map((suggestion, index) => (
              <div key={`${suggestion}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">{suggestion}</div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}