import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { IdentityAttackSurfaceDashboard, ManagedIdentityAuditDashboard } from '../types/dashboard';

interface Props { refreshTick: number; }

function scoreColor(score: number) {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-emerald-400';
}

function scoreBarColor(score: number) {
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function severityBadge(s: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300 border border-red-500/40',
    high: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    low: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  };
  return map[s?.toLowerCase()] ?? 'bg-slate-500/20 text-slate-300 border border-slate-500/40';
}

function pillarTag(label: string, color: string) {
  return <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>{label}</span>;
}

export function IdentityAccessReviewPage({ refreshTick }: Props) {
  const [identity, setIdentity] = useState<IdentityAttackSurfaceDashboard | null>(null);
  const [mia, setMia] = useState<ManagedIdentityAuditDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      nightWatchClient.getIdentityAttackSurfaceDashboard(refreshTick),
      nightWatchClient.getManagedIdentityAuditDashboard(refreshTick),
    ])
      .then(([id, mi]) => { if (alive) { setIdentity(id); setMia(mi); setIsLoading(false); } })
      .catch((e) => { if (alive) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { alive = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !identity) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!identity} />;
  }

  const riskScore = identity.identityRiskScore ?? 0;
  const findings = identity.findings ?? [];
  const criticalCount = findings.filter(f => f.severity?.toLowerCase() === 'critical').length;
  const highCount = findings.filter(f => f.severity?.toLowerCase() === 'high').length;
  const mediumCount = findings.filter(f => f.severity?.toLowerCase() === 'medium').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
        <PageBackButton />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-400">Identity &amp; Access Review</p>
            <h2 className="mt-1 text-2xl font-black text-white">Identity &amp; Access Assessment</h2>
            <p className="mt-1 text-sm text-slate-400">Privileged access, MFA, Conditional Access policies, and identity risk posture</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-slate-400">Identity Risk Score</p>
              <p className={`text-4xl font-black ${scoreColor(riskScore)}`}>{riskScore}</p>
              <p className="text-[10px] text-slate-500">/ 100</p>
            </div>
            <div className="w-2 self-stretch rounded-full bg-slate-700">
              <div className={`rounded-full w-full transition-all ${scoreBarColor(riskScore)}`} style={{ height: `${riskScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Owner Assignments', value: identity.ownerAssignments ?? 0, warn: (identity.ownerAssignments ?? 0) > 15, hint: '>15 is high risk' },
          { label: 'Guests with RBAC Role', value: identity.guestUserAssignments ?? 0, warn: (identity.guestUserAssignments ?? 0) > 0, hint: 'Guests with privileged roles' },
          { label: 'Service Principals w/ Owner', value: identity.servicePrincipalOwnerCount ?? 0, warn: (identity.servicePrincipalOwnerCount ?? 0) > 3, hint: '>3 is elevated risk' },
          { label: 'CA Policies Active', value: identity.conditionalAccessPolicies?.length ?? 0, warn: false, hint: 'Conditional access coverage' },
        ].map(({ label, value, warn, hint }) => (
          <div key={label} className={`rounded-2xl border p-4 ${warn ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-slate-800/40'}`}>
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`mt-1 text-3xl font-black ${warn ? 'text-red-400' : 'text-white'}`}>{value}</p>
            <p className="mt-1 text-[10px] text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      {/* Finding summary */}
      {findings.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <h3 className="text-sm font-bold text-white">Finding Summary</h3>
          <div className="mt-3 flex gap-4">
            {[
              { label: 'Critical', count: criticalCount, color: 'text-red-400' },
              { label: 'High', count: highCount, color: 'text-orange-400' },
              { label: 'Medium', count: mediumCount, color: 'text-amber-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`text-2xl font-black ${color}`}>{count}</span>
                <span className="text-xs text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk findings */}
      {findings.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Identity Risk Findings</h3>
          <div className="space-y-3">
            {findings.map((f, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadge(f.severity)}`}>{f.severity}</span>
                  {pillarTag('Identity', 'bg-violet-500/20 text-violet-300')}
                  <span className="text-sm font-semibold text-white">{f.title}</span>
                </div>
                {f.recommendation && (
                  <div className="mt-3 rounded-lg bg-slate-800/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">Recommendation</p>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{f.recommendation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privileged role assignments */}
      {(identity.privilegedRoles?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Privileged Role Assignments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-2 text-left font-medium">Principal</th>
                  <th className="pb-2 text-left font-medium">Type</th>
                  <th className="pb-2 text-left font-medium">Role</th>
                  <th className="pb-2 text-left font-medium">Subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {identity.privilegedRoles!.slice(0, 25).map((a, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-2 text-slate-200">{a.principalName}</td>
                    <td className="py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        a.principalType === 'ServicePrincipal' ? 'bg-violet-500/20 text-violet-300'
                        : a.principalType === 'Guest' ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-sky-500/20 text-sky-300'
                      }`}>{a.principalType}</span>
                    </td>
                    <td className="py-2 text-slate-300">{a.roleName}</td>
                    <td className="py-2 text-[11px] text-slate-500 max-w-[200px] truncate">{a.subscriptionName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(identity.privilegedRoles?.length ?? 0) > 25 && (
              <p className="mt-2 text-xs text-slate-500">Showing 25 of {identity.privilegedRoles!.length} assignments</p>
            )}
          </div>
        </div>
      )}

      {/* Conditional access policies */}
      {(identity.conditionalAccessPolicies?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Conditional Access Coverage</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {identity.conditionalAccessPolicies!.map((p, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                <p className="text-xs font-semibold text-slate-200">{p.policyName}</p>
                <div className="mt-2 flex gap-4 text-[11px]">
                  <span className="text-slate-400">Applied: <span className="text-white font-medium">{p.appliedCount?.toLocaleString()}</span></span>
                  {(p.blockedCount ?? 0) > 0 && <span className="text-red-400">Blocked: <span className="font-medium">{p.blockedCount}</span></span>}
                  {(p.mfaRequiredCount ?? 0) > 0 && <span className="text-cyan-400">MFA required: <span className="font-medium">{p.mfaRequiredCount}</span></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risky sign-ins */}
      {(identity.riskySignIns?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Risky Sign-In Events (Last 24h)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="pb-2 text-left font-medium">User</th>
                  <th className="pb-2 text-left font-medium">Risk Level</th>
                  <th className="pb-2 text-left font-medium">IP</th>
                  <th className="pb-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {identity.riskySignIns!.slice(0, 20).map((s, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-2 text-slate-200">{s.userDisplayName ?? s.userPrincipalName}</td>
                    <td className="py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        s.riskLevel?.toLowerCase() === 'high' ? 'bg-red-500/20 text-red-300'
                        : s.riskLevel?.toLowerCase() === 'medium' ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-600/40 text-slate-300'
                      }`}>{s.riskLevel}</span>
                    </td>
                    <td className="py-2 font-mono text-slate-400">{s.ipAddress}</td>
                    <td className="py-2 text-slate-500">{s.signInTime ? new Date(s.signInTime).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Managed identities summary */}
      {mia && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <h3 className="mb-3 text-sm font-bold text-white">Managed Identity Inventory</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: 'Total Managed Identities', value: (mia.totalUserAssigned ?? 0) + (mia.totalSystemAssigned ?? 0) },
              { label: 'System-Assigned', value: mia.totalSystemAssigned ?? 0 },
              { label: 'User-Assigned', value: mia.totalUserAssigned ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                <p className="text-[11px] text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
