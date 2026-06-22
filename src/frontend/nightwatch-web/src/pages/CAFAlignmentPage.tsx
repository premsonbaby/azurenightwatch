import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { HealthSnapshotHistory } from '../api/client';

interface Props { refreshTick: number; }

const MATURITY_LEVELS = ['Initial', 'Developing', 'Defined', 'Managed', 'Optimising'] as const;
type MaturityLevel = typeof MATURITY_LEVELS[number];

function scoreToMaturity(score: number): MaturityLevel {
  if (score >= 88) return 'Optimising';
  if (score >= 72) return 'Managed';
  if (score >= 55) return 'Defined';
  if (score >= 35) return 'Developing';
  return 'Initial';
}

function maturityColor(level: MaturityLevel) {
  const map: Record<MaturityLevel, string> = {
    Initial: 'text-red-400 bg-red-500/15 border-red-500/30',
    Developing: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    Defined: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    Managed: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    Optimising: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  };
  return map[level];
}

function maturityBarColor(level: MaturityLevel) {
  const map: Record<MaturityLevel, string> = {
    Initial: 'bg-red-500',
    Developing: 'bg-orange-500',
    Defined: 'bg-amber-500',
    Managed: 'bg-cyan-500',
    Optimising: 'bg-emerald-500',
  };
  return map[level];
}

interface Pillar {
  name: string;
  cafName: string;
  score: number;
  maturity: MaturityLevel;
  description: string;
  keyActions: string[];
  color: string;
  icon: string;
}

const CAF_PILLARS_META = [
  {
    cafName: 'Security',
    description: 'Protect the organisation from security threats across the full lifecycle of a cloud deployment.',
    color: 'text-red-400',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    keyActions: [
      'Enable Microsoft Defender for Cloud on all subscriptions',
      'Enforce MFA via Conditional Access for all users',
      'Implement PIM for privileged role activation',
      'Remove any-to-any NSG rules from all subnets',
    ],
  },
  {
    cafName: 'Cost Optimisation',
    description: 'Maximise business value by ensuring cloud spend is efficient and aligned to workload value.',
    color: 'text-emerald-400',
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    keyActions: [
      'Purchase Reserved Instances for stable baseline workloads',
      'Implement auto-shutdown for non-production environments',
      'Clean up orphaned resources and unattached disks',
      'Configure Budget alerts at 80% and 100% thresholds',
    ],
  },
  {
    cafName: 'Operational Excellence',
    description: 'Operate and monitor workloads reliably, with continuous process improvement.',
    color: 'text-indigo-400',
    icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
    keyActions: [
      'Deploy centralised monitoring via Azure Monitor + Log Analytics',
      'Configure diagnostic settings on all subscriptions',
      'Establish a monthly Advisor recommendation review cadence',
      'Implement tagging policy via Azure Policy',
    ],
  },
  {
    cafName: 'Performance Efficiency',
    description: 'Match resource provisioning to workload demand, avoiding over- and under-provisioning.',
    color: 'text-pink-400',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    keyActions: [
      'Right-size VMs with sustained high CPU utilisation',
      'Enable VMSS auto-scale for variable load workloads',
      'Deploy Azure CDN for web workloads with global users',
      'Review database DTU/vCore utilisation monthly',
    ],
  },
  {
    cafName: 'Reliability',
    description: 'Ensure workloads recover from failures and continue to function as designed.',
    color: 'text-cyan-400',
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
    keyActions: [
      'Enable Azure Backup for all production VMs and databases',
      'Deploy critical workloads across Availability Zones',
      'Implement geo-redundant storage and SQL failover groups',
      'Conduct quarterly DR failover drills',
    ],
  },
];

export function CAFAlignmentPage({ refreshTick }: Props) {
  const [history, setHistory] = useState<HealthSnapshotHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    nightWatchClient.getHealthSnapshotHistory(3, refreshTick)
      .then((h) => { if (alive) { setHistory(h); setIsLoading(false); } })
      .catch((e) => { if (alive) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { alive = false; };
  }, [refreshTick]);

  if (isLoading || loadError) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!history} />;
  }

  const latest = history?.months?.[0];

  const pillars: Pillar[] = [
    { name: 'Security', cafName: 'Security', score: latest?.securityPostureScore ?? 0, maturity: scoreToMaturity(latest?.securityPostureScore ?? 0), description: CAF_PILLARS_META[0].description, keyActions: CAF_PILLARS_META[0].keyActions, color: CAF_PILLARS_META[0].color, icon: CAF_PILLARS_META[0].icon },
    { name: 'Cost', cafName: 'Cost Optimisation', score: latest?.costEfficiencyScore ?? 0, maturity: scoreToMaturity(latest?.costEfficiencyScore ?? 0), description: CAF_PILLARS_META[1].description, keyActions: CAF_PILLARS_META[1].keyActions, color: CAF_PILLARS_META[1].color, icon: CAF_PILLARS_META[1].icon },
    { name: 'Governance', cafName: 'Operational Excellence', score: latest?.governanceComplianceScore ?? 0, maturity: scoreToMaturity(latest?.governanceComplianceScore ?? 0), description: CAF_PILLARS_META[2].description, keyActions: CAF_PILLARS_META[2].keyActions, color: CAF_PILLARS_META[2].color, icon: CAF_PILLARS_META[2].icon },
    { name: 'Performance', cafName: 'Performance Efficiency', score: latest?.performanceScore ?? 0, maturity: scoreToMaturity(latest?.performanceScore ?? 0), description: CAF_PILLARS_META[3].description, keyActions: CAF_PILLARS_META[3].keyActions, color: CAF_PILLARS_META[3].color, icon: CAF_PILLARS_META[3].icon },
    { name: 'Reliability', cafName: 'Reliability', score: latest?.reliabilityScore ?? 0, maturity: scoreToMaturity(latest?.reliabilityScore ?? 0), description: CAF_PILLARS_META[4].description, keyActions: CAF_PILLARS_META[4].keyActions, color: CAF_PILLARS_META[4].color, icon: CAF_PILLARS_META[4].icon },
  ];

  const overallScore = latest
    ? Math.round([latest.securityPostureScore, latest.costEfficiencyScore, latest.governanceComplianceScore, latest.performanceScore, latest.reliabilityScore].reduce((a, b) => a + b, 0) / 5)
    : 0;
  const overallMaturity = scoreToMaturity(overallScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
        <PageBackButton />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-400">Azure Cloud Adoption Framework</p>
            <h2 className="mt-1 text-2xl font-black text-white">Well-Architected Alignment</h2>
            <p className="mt-1 text-sm text-slate-400">Maturity assessment across the 5 CAF pillars — based on current NightWatch scores</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-4 text-center">
            <p className="text-xs text-slate-400">Overall Maturity</p>
            <p className={`mt-1 text-lg font-black ${maturityColor(overallMaturity).split(' ')[0]}`}>{overallMaturity}</p>
            <p className="text-[10px] text-slate-500">Score: {overallScore}/100</p>
          </div>
        </div>
      </div>

      {/* Maturity scale legend */}
      <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Maturity Scale</h3>
        <div className="flex gap-2 flex-wrap">
          {MATURITY_LEVELS.map((level) => (
            <div key={level} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${maturityColor(level)}`}>
              {level}
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Initial</strong> — Ad hoc, no formal processes &nbsp;·&nbsp;
          <strong className="text-slate-400">Developing</strong> — Some processes, inconsistently applied &nbsp;·&nbsp;
          <strong className="text-slate-400">Defined</strong> — Documented, consistently applied &nbsp;·&nbsp;
          <strong className="text-slate-400">Managed</strong> — Measured and controlled &nbsp;·&nbsp;
          <strong className="text-slate-400">Optimising</strong> — Continuously improved
        </div>
      </div>

      {/* Pillar cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pillars.map((pillar) => (
          <div key={pillar.name} className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl bg-slate-700/50 p-2 ${pillar.color}`}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={pillar.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">{pillar.cafName}</p>
                  <p className="text-sm font-bold text-white">{pillar.name}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-bold ${maturityColor(pillar.maturity)}`}>
                {pillar.maturity}
              </span>
            </div>

            {/* Score bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Score</span>
                <span className="font-semibold text-white">{Math.round(pillar.score)}/100</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${maturityBarColor(pillar.maturity)}`}
                  style={{ width: `${Math.max(2, pillar.score)}%` }}
                />
              </div>
            </div>

            {/* Maturity bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Maturity</span>
                <span className="text-slate-400">{MATURITY_LEVELS.indexOf(pillar.maturity) + 1}/5</span>
              </div>
              <div className="flex gap-0.5">
                {MATURITY_LEVELS.map((level, idx) => (
                  <div
                    key={level}
                    className={`h-1.5 flex-1 rounded-sm ${idx <= MATURITY_LEVELS.indexOf(pillar.maturity) ? maturityBarColor(pillar.maturity) : 'bg-slate-700'}`}
                  />
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">{pillar.description}</p>

            {/* Key actions */}
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Key Actions</p>
              <ul className="space-y-1.5">
                {pillar.keyActions.map((action) => (
                  <li key={action} className="flex items-start gap-2 text-xs text-slate-300">
                    <svg className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Summary table */}
      <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
        <h3 className="mb-4 text-sm font-bold text-white">Maturity Summary Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-2 text-left font-medium">CAF Pillar</th>
                <th className="pb-2 text-left font-medium">Score</th>
                <th className="pb-2 text-left font-medium">Maturity Level</th>
                <th className="pb-2 text-left font-medium">Trend (vs prev month)</th>
                <th className="pb-2 text-left font-medium">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pillars.map((p) => {
                const prevMonth = history?.months?.[1];
                const prevScore = prevMonth ? (
                  p.name === 'Security' ? prevMonth.securityPostureScore
                  : p.name === 'Cost' ? prevMonth.costEfficiencyScore
                  : p.name === 'Governance' ? prevMonth.governanceComplianceScore
                  : p.name === 'Performance' ? prevMonth.performanceScore
                  : prevMonth.reliabilityScore
                ) : null;
                const delta = prevScore !== null ? Math.round(p.score) - Math.round(prevScore) : null;

                return (
                  <tr key={p.name} className="hover:bg-white/5">
                    <td className="py-2.5 font-medium text-white">{p.cafName}</td>
                    <td className="py-2.5 font-mono text-slate-300">{Math.round(p.score)}</td>
                    <td className="py-2.5">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${maturityColor(p.maturity)}`}>{p.maturity}</span>
                    </td>
                    <td className="py-2.5">
                      {delta !== null ? (
                        <span className={delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'}>
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        ['Initial', 'Developing'].includes(p.maturity)
                          ? 'bg-red-500/20 text-red-300'
                          : p.maturity === 'Defined'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {['Initial', 'Developing'].includes(p.maturity) ? 'High' : p.maturity === 'Defined' ? 'Medium' : 'Low'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!latest && (
          <p className="mt-3 text-xs text-slate-500">No health snapshot data yet. Capture a snapshot from the Score History page to populate this assessment.</p>
        )}
      </div>
    </div>
  );
}
