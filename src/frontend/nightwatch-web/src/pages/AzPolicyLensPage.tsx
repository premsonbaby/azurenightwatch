import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { AzPolicyLensDashboard, PolicyAssignmentSummary, PolicySubCompliance } from '../types/dashboard';

interface AzPolicyLensPageProps {
  refreshTick: number;
}

const EFFECT_COLORS: Record<string, string> = {
  deny: '#f43f5e',
  audit: '#f59e0b',
  auditifnotexists: '#fbbf24',
  denyaction: '#f43f5e',
  deployifnotexists: '#06b6d4',
  modify: '#8b5cf6',
  disabled: '#475569',
  append: '#10b981',
  manual: '#64748b',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Security Center': '#f43f5e',
  'Monitoring': '#06b6d4',
  'Backup': '#10b981',
  'Guest Configuration': '#8b5cf6',
  'Tagging': '#f59e0b',
  'Networking': '#3b82f6',
  'Key Vault': '#ec4899',
  'Other': '#64748b',
};

function effectColor(effect: string) {
  return EFFECT_COLORS[effect.toLowerCase()] ?? '#64748b';
}

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#64748b';
}

function ComplianceBar({ value }: { value: number }) {
  const color = value >= 90 ? '#10b981' : value >= 70 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-700/60">
        <div className="h-2 rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{value.toFixed(1)}%</span>
    </div>
  );
}

function PriorityBadge({ score }: { score: number }) {
  const bg = score >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    : score >= 40 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-slate-700/40 text-slate-400 border-slate-600/30';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${bg}`}>
      P{score}
    </span>
  );
}

function EffectBadge({ effect }: { effect: string }) {
  const color = effectColor(effect);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ color, borderColor: color + '40', background: color + '15' }}
    >
      {effect}
    </span>
  );
}

export function AzPolicyLensPage({ refreshTick }: AzPolicyLensPageProps) {
  const [data, setData] = useState<AzPolicyLensDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);

    nightWatchClient.getAzPolicyLensDashboard(refreshTick)
      .then((response) => { if (isMounted) { setData(response); setIsLoading(false); } })
      .catch((error) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load Policy Radar data.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [refreshTick]);

  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={Boolean(data)} />;
  if (state.props.children !== undefined || !data) return state;

  return <AzPolicyLensContent data={data} />;
}

function AzPolicyLensContent({ data }: { data: AzPolicyLensDashboard }) {
  const [subSearch, setSubSearch] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSortBy, setAssignSortBy] = useState<'priority' | 'nonCompliant'>('priority');

  const overallPct = data.overallCompliancePercent;
  const overallColor = overallPct >= 90 ? 'text-emerald-300' : overallPct >= 70 ? 'text-amber-300' : 'text-rose-300';
  const overallBarColor = overallPct >= 90 ? 'bg-emerald-400' : overallPct >= 70 ? 'bg-amber-400' : 'bg-rose-400';

  const effectPieData = useMemo(
    () => data.effectBreakdown.map((e) => ({ name: e.effect, value: e.count })),
    [data.effectBreakdown],
  );

  const categoryBarData = useMemo(
    () => (data.categoryBreakdown ?? []).map((c) => ({
      name: c.category,
      nonCompliant: c.nonCompliantResources,
      fill: categoryColor(c.category),
    })),
    [data.categoryBreakdown],
  );

  const filteredSubs = useMemo(
    () => data.subscriptionCompliance.filter((s) =>
      !subSearch.trim() || s.subscriptionName.toLowerCase().includes(subSearch.trim().toLowerCase()),
    ),
    [data.subscriptionCompliance, subSearch],
  );

  const filteredAssigns = useMemo(() => {
    const base = data.topNonCompliantAssignments.filter((a) =>
      !assignSearch.trim() || a.displayName.toLowerCase().includes(assignSearch.trim().toLowerCase()),
    );
    return [...base].sort((a, b) =>
      assignSortBy === 'priority'
        ? (b.priorityScore ?? 0) - (a.priorityScore ?? 0)
        : b.nonCompliantResources - a.nonCompliantResources,
    );
  }, [data.topNonCompliantAssignments, assignSearch, assignSortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Policy Radar</h2>
        <p className="mt-2 text-sm text-slate-300">
          Azure Policy compliance posture — assignment inventory, non-compliant resources, category breakdown, priority scores, and per-subscription detail.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalAssignments} assignments · {data.customDefinitions} custom definitions · generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </section>

      {/* KPI row — 8 tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        {[
          { label: 'Total Assignments', value: data.totalAssignments, accent: 'border-cyan-400/25 bg-cyan-500/8', text: 'text-cyan-100' },
          { label: 'Non-Compliant', value: data.nonCompliantAssignments ?? 0, accent: 'border-rose-400/25 bg-rose-500/8', text: 'text-rose-100' },
          { label: 'Compliant', value: data.compliantAssignments ?? 0, accent: 'border-emerald-400/25 bg-emerald-500/8', text: 'text-emerald-100' },
          { label: 'Exemptions', value: data.totalExemptions ?? 0, accent: 'border-violet-400/25 bg-violet-500/8', text: 'text-violet-100' },
          { label: 'Custom Defs', value: data.customDefinitions, accent: 'border-indigo-400/25 bg-indigo-500/8', text: 'text-indigo-100' },
          { label: 'Non-Compliant Res.', value: data.totalNonCompliantResources, accent: data.totalNonCompliantResources > 0 ? 'border-orange-400/25 bg-orange-500/8' : 'border-slate-700/40 bg-slate-800/30', text: data.totalNonCompliantResources > 0 ? 'text-orange-100' : 'text-slate-400' },
          { label: 'Compliant Res.', value: data.totalCompliantResources, accent: 'border-teal-400/25 bg-teal-500/8', text: 'text-teal-100' },
          { label: 'Subscriptions', value: data.subscriptionCompliance.length, accent: 'border-slate-700/40 bg-slate-800/30', text: 'text-slate-200' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 ${stat.accent}`}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
            <p className={`mt-2 text-2xl font-black ${stat.text}`}>{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Overall compliance + assignments split */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Overall compliance gauge */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Overall Compliance</h3>
          <div className="mt-4 flex items-end gap-3">
            <p className={`text-5xl font-black ${overallColor}`}>{overallPct.toFixed(1)}%</p>
            <p className="mb-1 text-sm text-slate-400">of resources compliant</p>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-700/60">
            <div className={`h-3 rounded-full transition-all duration-500 ${overallBarColor}`} style={{ width: `${overallPct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
            <span><span className="font-semibold text-emerald-300">{data.totalCompliantResources.toLocaleString()}</span> Compliant</span>
            <span><span className="font-semibold text-rose-300">{data.totalNonCompliantResources.toLocaleString()}</span> Non-Compliant</span>
            {(data.totalExemptions ?? 0) > 0 && (
              <span><span className="font-semibold text-violet-300">{data.totalExemptions.toLocaleString()}</span> Exemptions</span>
            )}
          </div>
        </section>

        {/* Assignment compliance split */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Assignment Status</h3>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Non-Compliant Assignments', value: data.nonCompliantAssignments ?? 0, total: data.totalAssignments, color: '#f43f5e' },
              { label: 'Compliant Assignments', value: data.compliantAssignments ?? 0, total: data.totalAssignments, color: '#10b981' },
            ].map((item) => {
              const pct = data.totalAssignments > 0 ? (item.value / data.totalAssignments) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>{item.value} <span className="text-slate-500 font-normal">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl bg-slate-800/50 p-3 text-xs text-slate-300">
            <span className="font-semibold text-violet-300">{data.totalExemptions ?? 0}</span> policy exemptions active across tenant
          </div>
        </section>

        {/* Effect breakdown */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Effect Distribution</h3>
          {effectPieData.length > 0 ? (
            <div className="mt-2 flex items-center gap-4">
              <div className="h-[110px] w-[110px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={effectPieData} cx="50%" cy="50%" innerRadius="38%" outerRadius="68%" paddingAngle={2} dataKey="value">
                      {effectPieData.map((entry) => (
                        <Cell key={entry.name} fill={effectColor(entry.name)} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1">
                {effectPieData.slice(0, 7).map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: effectColor(entry.name) }} />
                      <span className="capitalize text-slate-200">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-slate-100">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No custom definitions found.</p>
          )}
        </section>
      </div>

      {/* Category breakdown chart */}
      {categoryBarData.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Non-Compliant Resources by Category
          </h3>
          <p className="mb-4 text-xs text-slate-400">Policy assignments grouped by category — higher bars indicate larger compliance gaps to close.</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                  formatter={(v) => [v, 'Non-Compliant Resources']}
                />
                <Bar dataKey="nonCompliant" radius={[4, 4, 0, 0]}>
                  {categoryBarData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {categoryBarData.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.fill }} />
                <span>{c.name}</span>
                <span className="font-bold" style={{ color: c.fill }}>{c.nonCompliant.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subscription compliance bar chart */}
      {data.subscriptionCompliance.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Compliance % by Subscription
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.subscriptionCompliance.slice(0, 20).map((s) => ({
                  name: s.subscriptionName.length > 18 ? s.subscriptionName.slice(0, 18) + '…' : s.subscriptionName,
                  compliance: Number(s.compliancePercent.toFixed(1)),
                  nonCompliant: s.nonCompliantResources,
                }))}
                margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }}
                  formatter={(v, name) => [name === 'compliance' ? `${v}%` : v, name === 'compliance' ? 'Compliance' : 'Non-Compliant']}
                />
                <Bar dataKey="compliance" radius={[3, 3, 0, 0]}>
                  {data.subscriptionCompliance.slice(0, 20).map((s) => (
                    <Cell key={s.subscriptionId} fill={s.compliancePercent >= 90 ? '#10b981' : s.compliancePercent >= 70 ? '#f59e0b' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Per-subscription detail table */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Subscription Detail ({filteredSubs.length})
          </h3>
          <input
            type="text"
            value={subSearch}
            onChange={(e) => setSubSearch(e.target.value)}
            placeholder="Filter subscriptions..."
            className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                <th className="px-3 py-2">Subscription</th>
                <th className="px-3 py-2 text-right">Non-Compliant</th>
                <th className="px-3 py-2 text-right">Compliant</th>
                <th className="px-3 py-2 text-right">Exempt</th>
                <th className="px-3 py-2 text-right">Conflict</th>
                <th className="px-3 py-2">Compliance %</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.map((sub) => (
                <SubRow key={sub.subscriptionId} sub={sub} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top non-compliant assignments with priority scores */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
              Non-Compliant Assignments ({filteredAssigns.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Priority score = compliance gap × effect severity × subscription spread</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-white/10 bg-slate-900 text-xs">
              {(['priority', 'nonCompliant'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setAssignSortBy(key)}
                  className={`px-3 py-1.5 transition ${assignSortBy === key ? 'rounded-lg bg-cyan-600/30 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {key === 'priority' ? 'By Priority' : 'By Volume'}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Filter..."
              className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
        </div>
        {filteredAssigns.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No non-compliant assignments found.</p>
        ) : (
          <div className="space-y-2">
            {filteredAssigns.map((a) => (
              <AssignmentRow key={a.assignmentId} assignment={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SubRow({ sub }: { sub: PolicySubCompliance }) {
  return (
    <tr className="border-b border-white/5 transition hover:bg-slate-800/30">
      <td className="px-3 py-2.5 font-medium text-slate-100">{sub.subscriptionName || sub.subscriptionId}</td>
      <td className="px-3 py-2.5 text-right">
        {sub.nonCompliantResources > 0 ? (
          <span className="font-semibold text-rose-300">{sub.nonCompliantResources.toLocaleString()}</span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-semibold text-emerald-300">{sub.compliantResources.toLocaleString()}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        {(sub.exemptResources ?? 0) > 0 ? (
          <span className="font-semibold text-violet-300">{sub.exemptResources.toLocaleString()}</span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        {(sub.conflictResources ?? 0) > 0 ? (
          <span className="font-semibold text-amber-300">{sub.conflictResources.toLocaleString()}</span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <ComplianceBar value={sub.compliancePercent} />
      </td>
    </tr>
  );
}

function AssignmentRow({ assignment }: { assignment: PolicyAssignmentSummary }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-slate-900/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">{assignment.displayName || 'Unnamed Assignment'}</p>
          {assignment.effect && <EffectBadge effect={assignment.effect} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {assignment.subscriptionName && (
            <span className="text-xs text-slate-400">{assignment.subscriptionName}</span>
          )}
          {(assignment.subscriptionsImpacted ?? 0) > 1 && (
            <span className="text-xs text-slate-500">{assignment.subscriptionsImpacted} subscriptions impacted</span>
          )}
          {assignment.scope && (
            <span className="max-w-xs truncate font-mono text-[10px] text-slate-600" title={assignment.scope}>
              {assignment.scope}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <PriorityBadge score={assignment.priorityScore ?? 0} />
        <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300">
          {assignment.nonCompliantResources.toLocaleString()} non-compliant
        </span>
      </div>
    </div>
  );
}
