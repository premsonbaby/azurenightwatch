import { useEffect, useState } from 'react';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { NetworkPerimeterDashboard, SecurityDashboard } from '../types/dashboard';

interface Props { refreshTick: number; }

function severityBadge(s: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300 border border-red-500/40',
    high: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    low: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    informational: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  };
  return map[s?.toLowerCase()] ?? 'bg-slate-500/20 text-slate-300 border border-slate-500/40';
}

export function NetworkSecurityReviewPage({ refreshTick }: Props) {
  const [perimeter, setPerimeter] = useState<NetworkPerimeterDashboard | null>(null);
  const [security, setSecurity] = useState<SecurityDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      nightWatchClient.getNetworkPerimeterDashboard(refreshTick),
      nightWatchClient.getSecurityDashboard(refreshTick),
    ])
      .then(([p, s]) => { if (alive) { setPerimeter(p); setSecurity(s); setIsLoading(false); } })
      .catch((e) => { if (alive) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { alive = false; };
  }, [refreshTick]);

  if (isLoading || loadError || !perimeter) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!perimeter} />;
  }

  const exposedResources = perimeter.exposedResources ?? [];
  const securityFindings = security?.findings ?? [];
  const criticalFindings = securityFindings.filter(f => f.riskLevel?.toLowerCase() === 'critical');
  const highFindings = securityFindings.filter(f => f.riskLevel?.toLowerCase() === 'high');

  const overallExposureScore = Math.min(100,
    perimeter.dangerousNsgRuleCount * 20 + perimeter.openManagementPortResources * 15 + perimeter.unprotectedPublicIps * 5
  );

  function exposureColor(score: number) {
    if (score >= 60) return 'text-red-400';
    if (score >= 30) return 'text-amber-400';
    return 'text-emerald-400';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
        <PageBackButton />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400">Network Security Review</p>
            <h2 className="mt-1 text-2xl font-black text-white">Network Security Assessment</h2>
            <p className="mt-1 text-sm text-slate-400">NSG rules, public IP exposure, perimeter security, and network attack surface</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-400">Exposure Score</p>
              <p className={`text-4xl font-black ${exposureColor(overallExposureScore)}`}>{overallExposureScore}</p>
              <p className="text-[10px] text-slate-500">/ 100 (higher = worse)</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Dangerous NSG Rules', value: perimeter.dangerousNsgRuleCount, warn: perimeter.dangerousNsgRuleCount > 0, hint: 'Any-to-any inbound allow rules' },
          { label: 'Open Mgmt Port Resources', value: perimeter.openManagementPortResources, warn: perimeter.openManagementPortResources > 0, hint: 'RDP/SSH exposed to internet' },
          { label: 'Total Public IPs', value: perimeter.totalPublicIps, warn: perimeter.totalPublicIps > 20, hint: 'Public IP addresses in use' },
          { label: 'Unprotected Public IPs', value: perimeter.unprotectedPublicIps, warn: perimeter.unprotectedPublicIps > 0, hint: 'PIPs without NSG protection' },
        ].map(({ label, value, warn, hint }) => (
          <div key={label} className={`rounded-2xl border p-4 ${warn ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-slate-800/40'}`}>
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`mt-1 text-3xl font-black ${warn ? 'text-red-400' : 'text-white'}`}>{value}</p>
            <p className="mt-1 text-[10px] text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      {/* Defender security findings summary */}
      {security && securityFindings.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Security Findings', value: securityFindings.length, warn: securityFindings.length > 10 },
            { label: 'Critical Findings', value: criticalFindings.length, warn: criticalFindings.length > 0 },
            { label: 'High Findings', value: highFindings.length, warn: highFindings.length > 3 },
          ].map(({ label, value, warn }) => (
            <div key={label} className={`rounded-2xl border p-4 ${warn ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-slate-800/40'}`}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className={`mt-1 text-3xl font-black ${warn ? 'text-amber-400' : 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Exposed resources */}
      {exposedResources.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Exposed Resources</h3>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">{exposedResources.length} found</span>
          </div>
          <div className="space-y-3">
            {exposedResources.map((res, i) => (
              <div key={i} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadge(res.riskLevel)}`}>
                    {res.riskLevel}
                  </span>
                  <span className="text-sm font-semibold text-white">{res.resourceName}</span>
                  <span className="text-xs text-slate-400">{res.resourceType}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                  <div><span className="text-slate-500">Subscription: </span><span className="text-slate-300">{res.subscriptionName}</span></div>
                  <div><span className="text-slate-500">Exposure: </span><span className="text-amber-300">{res.exposureType}</span></div>
                  {res.details && <div><span className="text-slate-500">Details: </span><span className="text-slate-300">{res.details}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div>
              <p className="text-sm font-semibold text-emerald-300">No dangerous network exposures detected</p>
              <p className="text-xs text-slate-400">No dangerous NSG rules or publicly exposed unprotected resources found.</p>
            </div>
          </div>
        </div>
      )}

      {/* Top security findings */}
      {securityFindings.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
          <h3 className="mb-4 text-sm font-bold text-white">Security Findings</h3>
          <div className="space-y-3">
            {securityFindings.slice(0, 10).map((f, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadge(f.riskLevel)}`}>{f.riskLevel}</span>
                  <span className="text-sm font-semibold text-white">{f.title}</span>
                </div>
                {f.impact && <p className="mt-2 text-xs text-slate-400 leading-relaxed">{f.impact}</p>}
                {f.remediation && (
                  <div className="mt-3 rounded-lg bg-slate-900/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">Remediation</p>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{f.remediation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations panel */}
      <div className="rounded-2xl border border-white/10 bg-slate-800/40 p-5">
        <h3 className="mb-4 text-sm font-bold text-white">Network Security Recommendations</h3>
        <div className="space-y-3">
          {[
            {
              title: 'Implement hub-spoke topology',
              desc: 'Route all egress traffic through a central Azure Firewall in the hub VNet. Apply default-deny outbound policy with explicit allow rules for required FQDNs.',
              effort: 'Long Term',
              severity: 'high',
            },
            {
              title: 'Audit and restrict NSG rules',
              desc: 'Review all inbound NSG rules. Replace wildcard source/port rules with explicit entries. Use Azure Service Tags for Azure service traffic.',
              effort: 'Quick Win',
              severity: 'critical',
            },
            {
              title: 'Enable DDoS Protection Standard',
              desc: 'Enable Azure DDoS Protection Standard on VNets containing public-facing resources to protect against volumetric attacks.',
              effort: 'Short Term',
              severity: 'medium',
            },
            {
              title: 'Remove unprotected public IPs',
              desc: `${perimeter.unprotectedPublicIps > 0 ? `${perimeter.unprotectedPublicIps} unprotected public IP(s) detected.` : 'Regularly review for'} Orphaned or unprotected public IPs expand attack surface unnecessarily.`,
              effort: 'Quick Win',
              severity: perimeter.unprotectedPublicIps > 0 ? 'medium' : 'low',
            },
          ].map((rec) => (
            <div key={rec.title} className="flex items-start gap-3 rounded-xl border border-white/5 bg-slate-900/50 p-4">
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${severityBadge(rec.severity)}`}>{rec.severity}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white">{rec.title}</p>
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{rec.effort}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{rec.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
