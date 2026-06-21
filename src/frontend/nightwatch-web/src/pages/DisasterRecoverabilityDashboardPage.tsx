import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { nightWatchClient } from '../api/client';
import type { DrDashboard } from '../types/dashboard';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';

interface DisasterRecoverabilityDashboardPageProps {
  refreshTick: number;
}

function scoreTone(value: number) {
  if (value >= 85) return 'text-emerald-300';
  if (value >= 70) return 'text-amber-300';
  return 'text-rose-300';
}
function scoreHex(value: number) {
  if (value >= 85) return '#34d399';
  if (value >= 70) return '#fbbf24';
  return '#f87171';
}

export function DisasterRecoverabilityDashboardPage({ refreshTick }: DisasterRecoverabilityDashboardPageProps) {
  const [dashboard, setDashboard] = useState<DrDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      setIsLoading((current) => current && !dashboard);
      setLoadError(null);
      try {
        const data = await nightWatchClient.getDrDashboard(refreshTick);
        if (mounted) setDashboard(data);
      } catch (error) {
        if (mounted) setLoadError(error instanceof Error ? error.message : 'Unable to load DR dashboard.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void loadDashboard();
    return () => { mounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(dashboard)} />;
  if (state.props.children !== undefined || !dashboard) return state;

  // Compliance trend — format timestamps
  const trendData = dashboard.complianceTrend.map((p) => ({
    month: new Date(p.timestamp).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    rpo: Math.round(p.rpoCompliancePercent),
    rto: Math.round(p.rtoCompliancePercent),
    readiness: Math.round(p.drReadinessScore),
  }));

  // Workload type breakdown for donut
  const typeCounts: Record<string, number> = {};
  for (const w of dashboard.workloadAssessments) {
    typeCounts[w.workloadType] = (typeCounts[w.workloadType] ?? 0) + 1;
  }
  const typeColors: Record<string, string> = {
    database: '#818cf8', app: '#38bdf8', storage: '#fb923c', container: '#4ade80', other: '#94a3b8',
  };
  const donutData = Object.entries(typeCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: typeColors[name] ?? '#94a3b8',
  }));

  // Compliance status breakdown
  const compliant = dashboard.workloadAssessments.filter((w) => w.complianceStatus === 'Compliant').length;
  const partial = dashboard.workloadAssessments.filter((w) => w.complianceStatus === 'Partial').length;
  const nonCompliant = dashboard.workloadAssessments.filter((w) => w.complianceStatus === 'Non-Compliant').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Disaster Recovery Readiness</h2>
        <p className="mt-3 text-sm text-slate-300">
          {dashboard.totalWorkloadsAssessed} workloads assessed · {dashboard.totalProtectedWorkloads} protected · {dashboard.totalUnprotectedWorkloads} at risk.
          {' '}RPO compliance is measured against actual last-backup recovery points where available.
        </p>
      </section>

      {/* KPI strip */}
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'DR Readiness',    value: `${dashboard.drReadinessScore.toFixed(1)}%`,        tone: scoreTone(dashboard.drReadinessScore) },
          { label: 'Recoverability',  value: `${dashboard.recoverabilityScore.toFixed(1)}%`,      tone: scoreTone(dashboard.recoverabilityScore) },
          { label: 'Business Risk',   value: `${dashboard.businessContinuityRiskScore.toFixed(1)}%`, tone: scoreTone(100 - dashboard.businessContinuityRiskScore) },
          { label: 'RPO Compliance',  value: `${dashboard.rpoCompliancePercent.toFixed(1)}%`,     tone: scoreTone(dashboard.rpoCompliancePercent) },
          { label: 'RTO Compliance',  value: `${dashboard.rtoCompliancePercent.toFixed(1)}%`,     tone: scoreTone(dashboard.rtoCompliancePercent) },
        ].map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
            <p className={`mt-2 text-xl font-black ${metric.tone}`}>{metric.value}</p>
          </article>
        ))}
      </section>

      {/* Compliance breakdown bar */}
      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Compliance Breakdown</h3>
        <div className="flex items-center gap-2 mb-2">
          {[
            { label: 'Compliant',     count: compliant,    color: '#34d399' },
            { label: 'Partial',       count: partial,      color: '#fbbf24' },
            { label: 'Non-Compliant', count: nonCompliant, color: '#f87171' },
          ].map((band) => (
            <div key={band.label} className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: band.color }} />
              <span>{band.label}</span>
              <span className="font-bold tabular-nums" style={{ color: band.color }}>{band.count}</span>
            </div>
          ))}
          <span className="ml-auto text-xs text-slate-500">{dashboard.totalWorkloadsAssessed} total</span>
        </div>
        <div className="h-3 flex rounded-full overflow-hidden gap-0.5">
          {compliant    > 0 && <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(compliant    / dashboard.totalWorkloadsAssessed) * 100}%` }} />}
          {partial      > 0 && <div className="h-full bg-amber-400  transition-all" style={{ width: `${(partial      / dashboard.totalWorkloadsAssessed) * 100}%` }} />}
          {nonCompliant > 0 && <div className="h-full bg-rose-400   transition-all" style={{ width: `${(nonCompliant / dashboard.totalWorkloadsAssessed) * 100}%` }} />}
        </div>
      </section>

      {/* Trend chart + workload type donut */}
      <section className="grid gap-4 xl:grid-cols-3">
        {/* Trend — 2/3 width */}
        <section className="xl:col-span-2 rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Compliance Trend (6 months)</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="drRpo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="drRto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="drReadiness" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34d399" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(val: unknown, name: unknown) => [`${val}%`, String(name)]}
                />
                <Area type="monotone" dataKey="rpo"      name="RPO Compliance" stroke="#818cf8" strokeWidth={2} fill="url(#drRpo)"      dot={false} />
                <Area type="monotone" dataKey="rto"      name="RTO Compliance" stroke="#38bdf8" strokeWidth={2} fill="url(#drRto)"      dot={false} />
                <Area type="monotone" dataKey="readiness" name="DR Readiness"  stroke="#34d399" strokeWidth={2} fill="url(#drReadiness)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">No trend data available.</p>
          )}
          <div className="mt-2 flex gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-indigo-400 inline-block" />RPO Compliance</span>
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-sky-400 inline-block" />RTO Compliance</span>
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-emerald-400 inline-block" />DR Readiness</span>
          </div>
        </section>

        {/* Workload type donut — 1/3 width */}
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 flex flex-col">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Workload Types</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%" cy="50%"
                  innerRadius="50%" outerRadius="80%"
                  dataKey="value"
                  paddingAngle={2}
                  isAnimationActive
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  formatter={(val: unknown, name: unknown) => [`${String(val)}`, String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1 w-full">
              {donutData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
                  <span className="text-slate-300 flex-1">{entry.name}</span>
                  <span className="font-bold tabular-nums" style={{ color: entry.color }}>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>

      {/* Top failing workloads + recommendations */}
      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Top Failing Workloads</h3>
          <div className="space-y-2">
            {dashboard.topFailingWorkloads.slice(0, 6).map((workload) => {
              const rpoGap = workload.achievableRpoMinutes - workload.desiredRpoMinutes;
              const rtoGap = workload.achievableRtoMinutes - workload.desiredRtoMinutes;
              return (
                <article key={workload.workloadId} className="rounded-xl border border-rose-300/20 bg-rose-500/8 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-rose-100">{workload.workloadName}</p>
                      <p className="mt-0.5 text-xs text-rose-300">{workload.subscriptionName} · {workload.environment} · <span className="capitalize">{workload.workloadType}</span></p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${workload.complianceStatus === 'Non-Compliant' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {workload.complianceStatus}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-3 text-[10px] text-slate-400">
                    <span>RPO: <span className={rpoGap > 0 ? 'text-rose-300 font-semibold' : 'text-emerald-300'}>{workload.achievableRpoMinutes}m</span> / target {workload.desiredRpoMinutes}m</span>
                    <span>RTO: <span className={rtoGap > 0 ? 'text-rose-300 font-semibold' : 'text-emerald-300'}>{workload.achievableRtoMinutes}m</span> / target {workload.desiredRtoMinutes}m</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div>
                      <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                        <span>RPO gap</span><span>{rpoGap > 0 ? `+${rpoGap}m` : 'OK'}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${Math.min(100, (workload.achievableRpoMinutes / Math.max(1, workload.desiredRpoMinutes * 3)) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                        <span>RTO gap</span><span>{rtoGap > 0 ? `+${rtoGap}m` : 'OK'}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.min(100, (workload.achievableRtoMinutes / Math.max(1, workload.desiredRtoMinutes * 3)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Actionable Recommendations</h3>
          <ul className="space-y-2 text-sm">
            {dashboard.actionableRecommendations.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/8 p-3">
                <span className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[9px] font-bold flex items-center justify-center">{index + 1}</span>
                <span className="text-cyan-50">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* Subscription risk ranking + governance targets */}
      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Subscription Risk Ranking</h3>
          <div className="space-y-2">
            {dashboard.subscriptionRiskRanking.map((item) => {
              const pct = item.nonCompliantWorkloads / Math.max(1, item.totalWorkloads);
              return (
                <article key={item.subscriptionId} className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-white truncate">{item.subscriptionName}</p>
                    <span className={`text-xs font-bold tabular-nums ml-2 shrink-0 ${item.riskScore >= 70 ? 'text-rose-300' : item.riskScore >= 40 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {item.riskScore.toFixed(0)}% risk
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: scoreHex(100 - item.riskScore) }} />
                  </div>
                  <p className="text-[10px] text-slate-400">{item.nonCompliantWorkloads}/{item.totalWorkloads} workloads non-compliant</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Governance Targets</h3>
          <div className="space-y-3">
            {[
              { label: 'Global RPO Target',    value: `${dashboard.governanceSettings.globalDesiredRpoMinutes} min` },
              { label: 'Global RTO Target',    value: `${dashboard.governanceSettings.globalDesiredRtoMinutes} min` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span className="text-sm font-bold text-cyan-200">{item.value}</span>
              </div>
            ))}
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Compliance Thresholds</p>
              {[
                { label: 'Green (compliant)',   pct: dashboard.governanceSettings.thresholds.greenPercent,      color: '#34d399' },
                { label: 'Amber (attention)',   pct: dashboard.governanceSettings.thresholds.amberPercent,      color: '#fbbf24' },
                { label: 'Red (at risk)',       pct: dashboard.governanceSettings.thresholds.redPercent,        color: '#f87171' },
                { label: 'Near breach',         pct: dashboard.governanceSettings.thresholds.nearBreachPercent, color: '#fb923c' },
              ].map((t) => (
                <div key={t.label} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="text-xs text-slate-400">{t.label}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: t.color }}>&ge; {t.pct}%</span>
                </div>
              ))}
            </div>
            {dashboard.governanceSettings.criticalityProfiles.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 mt-1">Criticality Profiles</p>
                <div className="space-y-1">
                  {dashboard.governanceSettings.criticalityProfiles.map((profile) => (
                    <div key={profile.name} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-1.5">
                      <span className="text-xs text-slate-300">{profile.name}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">RPO {profile.desiredRpoMinutes}m · RTO {profile.desiredRtoMinutes}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
