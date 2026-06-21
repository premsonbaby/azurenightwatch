import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type {
  IdentityAttackSurfaceDashboard,
  IdentityRiskFinding,
  PrivilegedRoleAssignment,
  RiskySignInEvent,
  ConditionalAccessPolicySummary,
} from '../types/dashboard';

interface Props { refreshTick: number; }

export function IdentityAttackSurfacePage({ refreshTick }: Props) {
  const [data, setData] = useState<IdentityAttackSurfaceDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading((prev) => prev || data === null);
    setLoadError(null);
    nightWatchClient.getIdentityAttackSurfaceDashboard(refreshTick)
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  return <IdentityAttackSurfaceContent data={data} />;
}

function severityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical': return 'text-red-400 bg-red-500/15 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
    case 'medium': return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    default: return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  }
}

function riskLevelColor(level: string) {
  switch (level.toLowerCase()) {
    case 'high': return 'text-red-400 bg-red-500/20';
    case 'medium': return 'text-amber-400 bg-amber-500/20';
    default: return 'text-slate-400 bg-slate-700/40';
  }
}

function principalTypeColor(type: string) {
  switch (type.toLowerCase()) {
    case 'serviceprincipal': return 'text-violet-400 bg-violet-500/15';
    case 'user': return 'text-sky-400 bg-sky-500/15';
    case 'guest': return 'text-amber-400 bg-amber-500/15';
    default: return 'text-slate-400 bg-slate-700/40';
  }
}

function riskScoreColor(score: number) {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  if (score >= 20) return 'text-yellow-400';
  return 'text-emerald-400';
}

function riskScoreBarColor(score: number) {
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-amber-500';
  if (score >= 20) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

function RiskFindingRow({ finding }: { finding: IdentityRiskFinding }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="border-b border-slate-700/50 last:border-0 px-4 py-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${severityColor(finding.severity)}`}>
            {finding.severity}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{finding.title}</p>
            <p className="text-xs text-slate-500">{finding.category}{finding.count > 0 ? ` · ${finding.count} detected` : ''}</p>
          </div>
        </div>
        <span className="text-xs text-slate-600 shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <p className="mt-2 pl-16 text-xs text-slate-400 leading-relaxed">{finding.recommendation}</p>
      )}
    </div>
  );
}

function PrivilegedRoleTable({ roles }: { roles: PrivilegedRoleAssignment[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Principal</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Role</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Subscription</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {roles.map((r, i) => (
            <tr key={i} className="hover:bg-slate-700/20 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.principalName}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${principalTypeColor(r.principalType)}`}>
                  {r.principalType}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.isOwnerRole ? 'text-red-400 bg-red-500/15' : 'text-slate-300 bg-slate-700/40'}`}>
                  {r.roleName}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400 text-xs">{r.subscriptionName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskySignInsTable({ signIns }: { signIns: RiskySignInEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">User</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Risk Level</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">IP Address</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {signIns.map((s, i) => (
            <tr key={i} className="hover:bg-slate-700/20 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-white text-sm">{s.userDisplayName || s.userPrincipalName}</p>
                {s.userDisplayName && s.userPrincipalName && (
                  <p className="text-xs text-slate-500">{s.userPrincipalName}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskLevelColor(s.riskLevel)}`}>
                  {s.riskLevel}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.ipAddress || '—'}</td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {s.signInTime ? new Date(s.signInTime).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaPoliciesTable({ policies }: { policies: ConditionalAccessPolicySummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Policy</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Applied</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Blocked</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">MFA Required</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {policies.map((p, i) => (
            <tr key={i} className="hover:bg-slate-700/20 transition-colors">
              <td className="px-4 py-3 font-medium text-white">{p.policyName}</td>
              <td className="px-4 py-3 text-right text-slate-300">{p.appliedCount.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <span className={p.blockedCount > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
                  {p.blockedCount.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={p.mfaRequiredCount > 0 ? 'text-amber-400' : 'text-slate-500'}>
                  {p.mfaRequiredCount.toLocaleString()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IdentityAttackSurfaceContent({ data }: { data: IdentityAttackSurfaceDashboard }) {
  const kpis = [
    { label: 'Owner Assignments', value: data.ownerAssignments, color: data.ownerAssignments > 5 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'SP Owners', value: data.servicePrincipalOwnerCount, color: data.servicePrincipalOwnerCount > 0 ? 'text-orange-400' : 'text-emerald-400' },
    { label: 'Guest Assignments', value: data.guestUserAssignments, color: data.guestUserAssignments > 0 ? 'text-amber-400' : 'text-emerald-400' },
    { label: 'Custom Roles', value: data.customRoleCount, color: data.customRoleCount > 10 ? 'text-amber-400' : 'text-slate-300' },
    { label: 'Risky Sign-Ins', value: data.riskySignInCount, color: data.riskySignInCount > 10 ? 'text-red-400' : data.riskySignInCount > 0 ? 'text-amber-400' : 'text-emerald-400' },
    { label: 'Risky Users', value: data.riskyUserCount, color: data.riskyUserCount > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'PIM Activations', value: data.pimActivationCount, color: 'text-violet-400' },
    { label: 'MFA Blocked', value: data.mfaBlockedCount, color: data.mfaBlockedCount > 0 ? 'text-amber-400' : 'text-emerald-400' },
  ];

  const highestSeverity = data.findings.length > 0
    ? (['critical', 'high', 'medium', 'low'].find(s => data.findings.some(f => f.severity.toLowerCase() === s)) ?? 'low')
    : 'low';

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl font-black text-white">Identity Attack Surface</h2>
            <p className="mt-2 text-sm text-slate-300">
              Privileged access posture, risky sign-ins, PIM events, and Conditional Access results across your Azure tenant
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
              {data.totalPrivilegedAssignments.toLocaleString()} total assignments
              · {data.ownerAssignments} owners
              · {data.findings.length} finding{data.findings.length !== 1 ? 's' : ''}
              · {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="text-center shrink-0">
            <p className={`text-5xl font-black ${riskScoreColor(data.identityRiskScore)}`}>{data.identityRiskScore}</p>
            <p className="text-xs text-slate-400 mt-1">Risk Score</p>
            <div className="mt-2 w-24 h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${riskScoreBarColor(data.identityRiskScore)}`}
                style={{ width: `${data.identityRiskScore}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-center">
            <p className={`text-2xl font-black ${k.color}`}>{k.value.toLocaleString()}</p>
            <p className="mt-1 text-xs leading-tight text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Log Analytics coverage banner */}
      {!data.hasSignInLogData && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-300">
            <span className="font-semibold">Sign-in log data not available.</span>
            {' '}Risky sign-ins, risky users, and Conditional Access results require Log Analytics workspace with Entra diagnostic settings configured.
          </p>
        </div>
      )}

      {/* Findings */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <div className="border-b border-slate-700 bg-slate-900/40 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Identity Risk Findings</h3>
          {data.findings.length > 0 && (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityColor(highestSeverity)}`}>
              Highest: {highestSeverity}
            </span>
          )}
        </div>
        <div>
          {data.findings.map((f) => <RiskFindingRow key={f.id} finding={f} />)}
        </div>
      </div>

      {/* Privileged roles */}
      {data.privilegedRoles.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="border-b border-slate-700 bg-slate-900/40 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Owner Role Assignments</h3>
            <span className="text-xs text-slate-500">{data.privilegedRoles.length} shown</span>
          </div>
          <PrivilegedRoleTable roles={data.privilegedRoles} />
        </div>
      )}

      {/* Conditional access policies */}
      {data.conditionalAccessPolicies.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="border-b border-slate-700 bg-slate-900/40 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-300">Conditional Access Policy Activity (24h)</h3>
          </div>
          <CaPoliciesTable policies={data.conditionalAccessPolicies} />
        </div>
      )}

      {/* Risky sign-ins */}
      {data.riskySignIns.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="border-b border-slate-700 bg-slate-900/40 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Risky Sign-In Events (24h)</h3>
            <span className="text-xs text-slate-500">{data.riskySignInCount} total · {data.riskySignIns.length} shown</span>
          </div>
          <RiskySignInsTable signIns={data.riskySignIns} />
        </div>
      )}

      {/* PIM + audit summary */}
      {data.hasAuditLogData && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">PIM & Audit Events (24h)</h3>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-2xl font-black text-violet-400">{data.pimActivationCount.toLocaleString()}</span>
              <p className="text-xs text-slate-400 mt-0.5">PIM role activations</p>
            </div>
            <div>
              <span className="text-2xl font-black text-amber-400">{data.mfaBlockedCount.toLocaleString()}</span>
              <p className="text-xs text-slate-400 mt-0.5">MFA blocked sign-ins</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
