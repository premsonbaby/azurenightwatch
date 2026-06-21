import { useState } from 'react';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { useNightWatchDashboardData } from '../hooks/useNightWatchDashboardData';
import type { SecurityFinding, ResourceInsight, DashboardMetric } from '../types/dashboard';

interface SecurityDashboardPageProps {
  refreshTick: number;
}

function riskBadge(level: string | null | undefined) {
  switch ((level ?? '').toLowerCase()) {
    case 'critical': return 'text-red-400 bg-red-500/15 border border-red-500/30';
    case 'high':     return 'text-orange-400 bg-orange-500/15 border border-orange-500/30';
    case 'medium':   return 'text-amber-400 bg-amber-500/15 border border-amber-500/30';
    default:         return 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30';
  }
}

function riskLeftBorder(level: string | null | undefined) {
  switch ((level ?? '').toLowerCase()) {
    case 'critical': return 'border-l-red-500';
    case 'high':     return 'border-l-orange-500';
    case 'medium':   return 'border-l-amber-500';
    default:         return 'border-l-emerald-500';
  }
}

function metricStatusColor(status: string | null | undefined) {
  const s = (status ?? '').toLowerCase();
  if (s.includes('critical') || s.includes('fail') || s.includes('high risk')) return 'text-red-400';
  if (s.includes('warning') || s.includes('moderate') || s.includes('medium')) return 'text-amber-400';
  if (s.includes('good') || s.includes('pass') || s.includes('healthy') || s.includes('ok')) return 'text-emerald-400';
  return 'text-cyan-400';
}

function formatMetricValue(value: number | null, unit: string) {
  if (value === null) return 'N/A';
  return unit === '%' ? `${value.toFixed(1)}%` : `${value.toLocaleString()}${unit ? ' ' + unit : ''}`;
}

function FindingCard({ finding }: { finding: SecurityFinding }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`cursor-pointer rounded-xl border-l-4 border border-white/8 bg-slate-900/60 p-4 transition-colors hover:bg-slate-800/50 ${riskLeftBorder(finding.riskLevel)}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug text-white">{finding.title}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${riskBadge(finding.riskLevel)}`}>
            {finding.riskLevel}
          </span>
          <span className="text-[10px] text-slate-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          <p className="text-xs text-slate-300">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Impact</span>
            {finding.impact}
          </p>
          <p className="text-xs text-cyan-300">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Fix</span>
            {finding.remediation}
          </p>
          {finding.resourceId && (
            <p className="truncate font-mono text-[10px] text-slate-500">{finding.resourceId}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
      <p className="mt-2 text-2xl font-black text-white">{formatMetricValue(metric.value, metric.unit)}</p>
      <p className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${metricStatusColor(metric.status)}`}>
        {metric.status}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{metric.description}</p>
    </div>
  );
}

function ExposedResourceCard({ resource }: { resource: ResourceInsight }) {
  return (
    <div className={`rounded-xl border-l-4 border border-white/8 bg-slate-900/60 p-4 ${riskLeftBorder(resource.riskLevel)}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-white">{resource.resourceName}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${riskBadge(resource.riskLevel)}`}>
          {resource.riskLevel}
        </span>
      </div>
      <span className="mt-2 inline-block rounded bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-300">
        {resource.category}
      </span>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{resource.description}</p>
    </div>
  );
}

export function SecurityDashboardPage({ refreshTick }: SecurityDashboardPageProps) {
  const { security, isLoading, loadError, hasCoreData } = useNightWatchDashboardData(refreshTick, 'security');
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !hasCoreData || !security) {
    return state;
  }

  const findings       = security.findings        ?? [];
  const metrics        = security.metrics         ?? [];
  const exposedRes     = security.exposedResources ?? [];
  const coverageNotes  = security.coverageNotes    ?? [];

  const criticalCount = findings.filter((f) => f.riskLevel?.toLowerCase() === 'critical').length;
  const highCount     = findings.filter((f) => f.riskLevel?.toLowerCase() === 'high').length;
  const mediumCount   = findings.filter((f) => f.riskLevel?.toLowerCase() === 'medium').length;

  const kpis = [
    { label: 'Total Findings',    value: findings.length,   color: findings.length > 0   ? 'text-rose-400'   : 'text-emerald-400' },
    { label: 'Critical',          value: criticalCount,      color: criticalCount > 0      ? 'text-red-400'    : 'text-slate-500' },
    { label: 'High',              value: highCount,          color: highCount > 0          ? 'text-orange-400' : 'text-slate-500' },
    { label: 'Medium',            value: mediumCount,        color: mediumCount > 0        ? 'text-amber-400'  : 'text-slate-500' },
    { label: 'Exposed Resources', value: exposedRes.length,  color: exposedRes.length > 0  ? 'text-amber-400'  : 'text-emerald-400' },
    { label: 'Metrics Tracked',   value: metrics.length,     color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Security Overview</h2>
        <p className="mt-1 text-sm text-slate-400">
          Exposure, posture, and compromise blast radius across your Azure environment
        </p>
        <p className="mt-3 text-xs text-slate-500">
          {findings.length} finding{findings.length !== 1 ? 's' : ''}
          {' · '}
          {exposedRes.length} exposed resource{exposedRes.length !== 1 ? 's' : ''}
          {' · '}
          {metrics.length} metrics
        </p>
      </section>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-3 text-center">
            <p className={`text-2xl font-black ${k.color}`}>{k.value.toLocaleString()}</p>
            <p className="mt-1 text-[11px] leading-tight text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Findings + Blast Radius ── */}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Active Findings
            {findings.length > 0 && (
              <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] text-rose-400">
                {findings.length}
              </span>
            )}
          </h3>
          {findings.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <span className="text-lg text-emerald-400">✓</span>
              <p className="text-sm text-slate-300">No active findings — environment looks clean.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {findings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          )}
        </section>

        <RelationshipGraph
          nodes={security.blastRadiusNodes ?? []}
          edges={security.blastRadiusEdges ?? []}
          title="Security Blast Radius"
        />
      </div>

      {/* ── Security Metrics ── */}
      {metrics.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Security Metrics</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {metrics.map((m) => (
              <MetricCard key={m.key} metric={m} />
            ))}
          </div>
        </section>
      )}

      {/* ── Exposed Resources ── */}
      {exposedRes.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Exposed Resources
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-400">
              {exposedRes.length}
            </span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exposedRes.map((r) => (
              <ExposedResourceCard key={`${r.resourceId}-${r.category}`} resource={r} />
            ))}
          </div>
        </section>
      )}

      {/* ── Coverage Notes ── */}
      {coverageNotes.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Coverage Notes</h3>
          <ul className="space-y-2">
            {coverageNotes.map((note, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-slate-300"
              >
                <span className="mt-0.5 shrink-0 text-cyan-400">i</span>
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
