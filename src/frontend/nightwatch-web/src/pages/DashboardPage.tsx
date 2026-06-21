import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { LineTrendChart } from '../components/LineTrendChart';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { ScoreCard } from '../components/ScoreCard';
import type {
  CostDashboard,
  ExecutiveDashboard,
  GovernanceDashboard,
  PerformanceDashboard,
  SecurityDashboard,
  SmartFeatures,
  TenantOverview,
} from '../types/dashboard';

interface DashboardPageProps {
  refreshTick: number;
}

export function DashboardPage({ refreshTick }: DashboardPageProps) {
  const [executive, setExecutive] = useState<ExecutiveDashboard | null>(null);
  const [security, setSecurity] = useState<SecurityDashboard | null>(null);
  const [performance, setPerformance] = useState<PerformanceDashboard | null>(null);
  const [cost, setCost] = useState<CostDashboard | null>(null);
  const [governance, setGovernance] = useState<GovernanceDashboard | null>(null);
  const [smart, setSmart] = useState<SmartFeatures | null>(null);
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [executiveData, securityData, performanceData, costData, governanceData, smartData, tenantData] =
          await Promise.all([
            nightWatchClient.getExecutiveDashboard(),
            nightWatchClient.getSecurityDashboard(),
            nightWatchClient.getPerformanceDashboard(),
            nightWatchClient.getCostDashboard(),
            nightWatchClient.getGovernanceDashboard(),
            nightWatchClient.getSmartFeatures(),
            nightWatchClient.getAzureTenantOverview(),
          ]);

        setExecutive(executiveData);
        setSecurity(securityData);
        setPerformance(performanceData);
        setCost(costData);
        setGovernance(governanceData);
        setSmart(smartData);
        setTenants(tenantData);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load live dashboard data.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadAll();
  }, [refreshTick]);

  const hasCoreData = Boolean(executive && security && performance && cost && governance && smart);

  if (isLoading && !hasCoreData) {
    return (
      <div className="rounded-xl border border-white/15 bg-slate-900/70 p-6 text-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" aria-hidden="true" />
          <div className="space-y-2">
            <div className="h-2 w-28 animate-pulse rounded bg-cyan-200/20" />
            <div className="h-2 w-20 animate-pulse rounded bg-slate-200/20" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !hasCoreData) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">Live Data Unavailable</p>
        <p className="mt-2 text-sm text-rose-50/90">{loadError}</p>
      </div>
    );
  }

  if (!executive || !security || !performance || !cost || !governance || !smart) {
    return <div className="rounded-xl border border-white/15 bg-slate-900/70 p-6 text-slate-200">No telemetry returned from the API.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Executive Dashboard</p>
            <h1 className="mt-2 text-3xl font-black text-white">Azure Night Watch</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">{executive.executiveSummary}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ScoreCard label="Azure Health" value={executive.azureHealthScore} />
        <ScoreCard label="Security Posture" value={executive.securityPostureScore} />
        <ScoreCard label="Performance" value={executive.performanceScore} />
        <ScoreCard label="Cost Efficiency" value={executive.costEfficiencyScore} />
        <ScoreCard label="Reliability" value={executive.reliabilityScore} />
        <ScoreCard label="Governance" value={executive.governanceComplianceScore} />
      </section>

      <section className="grid gap-4">
        <LineTrendChart data={executive.dailyTrend.slice().reverse().map((x) => ({ name: x.name, value: x.value }))} title="Daily Trend Analysis" chartType="bar" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Security Intelligence</h3>
          <div className="space-y-2">
            {security.findings.map((finding) => (
              <article key={finding.id} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                <p className="text-sm font-semibold text-white">{finding.title}</p>
                <p className="text-xs text-slate-300">{finding.impact}</p>
                <p className="mt-1 text-xs text-cyan-200">Remediation: {finding.remediation}</p>
              </article>
            ))}
          </div>
        </section>

        <RelationshipGraph nodes={security.blastRadiusNodes} edges={security.blastRadiusEdges} title="Security Blast Radius" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Performance & Reliability</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={performance.cpuAnomalies.slice(0, 12).map((x, i) => ({ idx: i, cpu: x.value, latency: performance.diskLatencyMs[i]?.value ?? 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="idx" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#22d3ee" strokeWidth={2} />
                <Line type="monotone" dataKey="latency" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm text-amber-200">SLA Risk Prediction: {performance.slaRiskScore}%</p>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Cost Optimization</h3>
          <p className="text-sm text-slate-300">Current Month: EUR {cost.currentMonthCost.toLocaleString()}</p>
          <p className="text-sm text-slate-300">Predicted Next Month: EUR {cost.predictedNextMonthCost.toLocaleString()}</p>
          <div className="mt-3 space-y-2">
            {cost.recommendations.map((item, index) => (
              <article key={`${item.title}-${index}`} className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-3">
                <p className="text-sm font-semibold text-emerald-100">{item.title}</p>
                <p className="text-xs text-emerald-50/90">{item.description}</p>
                <p className="mt-1 text-xs text-emerald-100">Estimated savings: EUR {item.estimatedMonthlySavings.toLocaleString()}/month</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Governance Dashboard</h3>
          <ul className="space-y-2 text-sm text-slate-200">
            <li>Tag compliance: {governance.tagCompliancePercent}%</li>
            <li>Naming compliance: {governance.namingCompliancePercent}%</li>
            <li>Landing zone compliance: {governance.landingZoneCompliancePercent}%</li>
          </ul>
          <div className="mt-3 space-y-2">
            {governance.driftAlerts.map((alert, index) => (
              <div key={`${alert}-${index}`} className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-xs text-rose-100">{alert}</div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Smart Features</h3>
          <ul className="space-y-2 text-sm text-slate-200">
            <li>Technical Debt Score: {smart.technicalDebtScore}/100</li>
            <li>Suppressed duplicate alerts: {smart.suppressedAlerts}</li>
            <li>Environment maturity: {smart.environmentMaturityScore}</li>
          </ul>
          <div className="mt-3 space-y-2">
            {smart.whatChanged.map((event, index) => (
              <div key={`${event}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-2 text-xs text-cyan-50">{event}</div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">MSP Multi-Tenant Overview</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <article key={tenant.tenantId} className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <p className="text-sm font-semibold text-white">{tenant.tenantName}</p>
              <p className="text-xs text-slate-300">Subscriptions: {tenant.subscriptionCount}</p>
              <p className="text-xs text-slate-300">Overall risk: {tenant.overallRiskScore}%</p>
              <p className="text-xs text-rose-200">Critical alerts: {tenant.activeCriticalAlerts}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
