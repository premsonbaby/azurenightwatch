import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type {
  AzureFirewallDashboard,
  AzureFirewallInstance,
  AzureFirewallPolicy,
  AzureFirewallPermissiveRule,
  AzureFirewallThreatHit,
  AzureFirewallInsight,
} from '../types/dashboard';

const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 };

const SEVERITY_COLOR: Record<string, string> = {
  High: 'text-red-400 border-red-500/30 bg-red-950/30',
  Medium: 'text-amber-400 border-amber-500/30 bg-amber-950/30',
  Low: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30',
};

function stateColor(s: string) {
  if (s.toLowerCase() === 'succeeded') return 'text-emerald-400';
  if (s.toLowerCase().includes('fail') || s.toLowerCase().includes('error')) return 'text-red-400';
  return 'text-amber-400';
}

function threatIntelColor(mode: string) {
  if (mode.toLowerCase() === 'off') return 'text-red-400';
  if (mode.toLowerCase() === 'alert and deny') return 'text-emerald-400';
  return 'text-amber-400';
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtHour(h: string): string {
  try {
    return new Date(h).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return h;
  }
}

export default function AzureFirewallPage() {
  const [data, setData] = useState<AzureFirewallDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fwFilter, setFwFilter] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');

  useEffect(() => {
    nightWatchClient.getAzureFirewallDashboard()
      .then(setData)
      .catch((e: Error) => setLoadError(e?.message ?? 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const blockRate = data.totalAllowedLast24h + data.totalBlockedLast24h > 0
    ? (data.totalBlockedLast24h / (data.totalAllowedLast24h + data.totalBlockedLast24h) * 100).toFixed(1)
    : '0.0';

  const filteredFw = data.firewalls.filter((f) =>
    !fwFilter ||
    f.name.toLowerCase().includes(fwFilter.toLowerCase()) ||
    f.subscriptionName.toLowerCase().includes(fwFilter.toLowerCase()) ||
    f.location.toLowerCase().includes(fwFilter.toLowerCase()),
  );

  const filteredRules = data.permissiveRules.filter((r) =>
    !ruleFilter ||
    r.policyName.toLowerCase().includes(ruleFilter.toLowerCase()) ||
    r.ruleName.toLowerCase().includes(ruleFilter.toLowerCase()) ||
    r.ruleCollectionName.toLowerCase().includes(ruleFilter.toLowerCase()),
  );

  const trafficChartData = data.trafficTrend.map((t) => ({
    hour: fmtHour(t.hour),
    Allowed: t.allowedCount,
    Blocked: t.deniedCount,
  }));

  const skuData = Object.entries(
    data.firewalls.reduce<Record<string, number>>((acc, f) => {
      acc[f.skuTier] = (acc[f.skuTier] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['#22d3ee', '#f59e0b', '#ef4444', '#a78bfa', '#34d399'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black text-white">Azure Firewall</h1>
          {!data.hasLogAnalyticsData && data.totalFirewalls > 0 && (
            <span className="rounded-full border border-amber-500/40 bg-amber-950/40 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
              No Log Analytics — configure diagnostic settings for traffic insights
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Firewall inventory, traffic analysis, threat intelligence hits, and rule quality assessment across all subscriptions
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalFirewalls} firewall{data.totalFirewalls !== 1 ? 's' : ''} · {data.healthyCount} healthy
          {data.degradedCount > 0 ? ` · ${data.degradedCount} degraded` : ''} ·{' '}
          {data.hasPolicies ? `${data.policies.length} polic${data.policies.length !== 1 ? 'ies' : 'y'}` : 'classic rules only'}
        </p>
      </section>

      {/* KPI row — direct in flow */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Firewalls', value: data.totalFirewalls, sub: 'discovered', color: 'text-cyan-300', accent: 'border-cyan-400/25 bg-cyan-500/5' },
          { label: 'Healthy', value: data.healthyCount, sub: 'provisioned OK', color: 'text-emerald-400', accent: 'border-emerald-400/25 bg-emerald-500/5' },
          { label: 'Degraded', value: data.degradedCount, sub: 'needs attention', color: data.degradedCount > 0 ? 'text-red-400' : 'text-slate-500', accent: data.degradedCount > 0 ? 'border-red-400/25 bg-red-500/5' : 'border-slate-700/40 bg-slate-800/30' },
          { label: 'Allowed (24 h)', value: fmtK(data.totalAllowedLast24h), sub: 'connections', color: 'text-emerald-300', accent: 'border-emerald-400/20 bg-emerald-500/5' },
          { label: 'Blocked (24 h)', value: fmtK(data.totalBlockedLast24h), sub: `${blockRate}% block rate`, color: data.totalBlockedLast24h > 0 ? 'text-red-300' : 'text-slate-500', accent: data.totalBlockedLast24h > 0 ? 'border-red-400/25 bg-red-500/5' : 'border-slate-700/40 bg-slate-800/30' },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl border p-5 text-center ${k.accent}`}>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{k.label}</p>
            <p className={`mt-3 text-4xl font-black ${k.color}`}>{k.value}</p>
            <p className="mt-1 text-xs text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Insights & Recommendations
          </h3>
          <div className="space-y-2">
            {data.insights.map((ins: AzureFirewallInsight, i) => (
              <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3 ${SEVERITY_COLOR[ins.severity] ?? 'text-slate-300 border-slate-600/30 bg-slate-800/30'}`}>
                <span className="mt-0.5 shrink-0 text-base">
                  {ins.severity === 'High' ? '🔴' : ins.severity === 'Medium' ? '🟡' : '🟢'}
                </span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide">{ins.category} — </span>
                  <span className="text-sm">{ins.message}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Traffic trend + SKU pie */}
      {data.totalFirewalls === 0 ? (
        <section className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-8 text-center">
          <p className="text-2xl">🔥</p>
          <p className="mt-3 text-base font-semibold text-slate-200">No Azure Firewalls found</p>
          <p className="mt-2 text-sm text-slate-400">No Azure Firewall instances detected in the configured subscriptions.</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Traffic & Inventory</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {trafficChartData.length > 0 && (
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400">Traffic Trend — Last 24 Hours</p>
                  <span className="text-xs text-slate-500">{blockRate}% block rate</span>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trafficChartData} margin={{ left: -10 }}>
                      <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmtK(Number(v ?? 0))} />
                      <Area type="monotone" dataKey="Allowed" stackId="1" stroke="#34d399" fill="#34d39930" />
                      <Area type="monotone" dataKey="Blocked" stackId="1" stroke="#ef4444" fill="#ef444430" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {skuData.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Firewalls by SKU Tier</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={skuData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                        {skuData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {trafficChartData.length === 0 && skuData.length === 0 && (
              <div className="md:col-span-3 rounded-xl border border-slate-700/40 bg-slate-800/30 p-8 text-center text-sm text-slate-400">
                Configure diagnostic settings to enable traffic insights.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Threat intelligence */}
      {(data.topBlockedDestinations.length > 0 || data.threatHits.length > 0) && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Threat Intelligence</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.topBlockedDestinations.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Top Blocked Destinations (24 h)</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.topBlockedDestinations.map((b) => ({
                        name: b.destination.length > 28 ? b.destination.slice(0, 26) + '…' : b.destination,
                        hits: b.hitCount,
                      }))}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => fmtK(v)} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => fmtK(Number(v ?? 0))} />
                      <Bar dataKey="hits" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {data.threatHits.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-slate-400">Threat Intelligence Hits (24 h)</p>
                  <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-[10px] text-red-300">{data.threatIntelHits} total</span>
                </div>
                <div className="overflow-x-auto max-h-52 overflow-y-auto">
                  <table className="min-w-full text-left text-sm text-slate-200">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                        {['Threat', 'Source IP', 'Destination', 'Action', 'Count'].map((h) => (
                          <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.threatHits.map((t: AzureFirewallThreatHit, i) => (
                        <tr key={i} className="border-b border-white/5 transition hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-red-300 font-medium whitespace-nowrap max-w-[140px] truncate">{t.threatName || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{t.sourceIp || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{t.destinationIp || '—'}</td>
                          <td className={`px-3 py-2 font-medium whitespace-nowrap ${t.action.toLowerCase().includes('deny') ? 'text-red-400' : 'text-amber-400'}`}>{t.action || '—'}</td>
                          <td className="px-3 py-2 text-cyan-300 font-bold whitespace-nowrap">{fmtK(t.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Overly permissive rules */}
      {data.permissiveRules.length > 0 && (
        <section className="rounded-2xl border border-red-500/20 bg-red-950/10 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
                ⚠ Overly Permissive Rules ({filteredRules.length})
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Allow rules with wildcard (*) source, destination, or port ranges — should be restricted to least-privilege.
              </p>
            </div>
            <input
              value={ruleFilter}
              onChange={(e) => setRuleFilter(e.target.value)}
              placeholder="Filter rules…"
              className="bg-slate-800/60 text-slate-100 text-xs rounded-lg px-3 py-1.5 border border-white/10 outline-none focus:border-red-400/50 w-48 shrink-0"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {['Policy', 'Rule Collection', 'Rule Name', 'Source', 'Destination', 'Ports'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((r: AzureFirewallPermissiveRule, i) => (
                  <tr key={i} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{r.policyName}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{r.ruleCollectionName}</td>
                    <td className="px-3 py-3 text-slate-200 whitespace-nowrap">{r.ruleName}</td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${r.sourceAddresses.includes('*') ? 'text-red-400 font-bold' : 'text-slate-400'}`}>{r.sourceAddresses}</td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${r.destinationAddresses.includes('*') ? 'text-red-400 font-bold' : 'text-slate-400'}`}>{r.destinationAddresses}</td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${r.destinationPorts.includes('*') ? 'text-red-400 font-bold' : 'text-slate-400'}`}>{r.destinationPorts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Firewall inventory */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200 flex-1">
            Firewall Inventory ({filteredFw.length})
          </h3>
          <input
            value={fwFilter}
            onChange={(e) => setFwFilter(e.target.value)}
            placeholder="Filter firewalls…"
            className="bg-slate-800/60 text-slate-100 text-xs rounded-lg px-3 py-1.5 border border-white/10 outline-none focus:border-cyan-500/50 w-48 shrink-0"
          />
        </div>
        {filteredFw.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No firewalls match the filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {['Name', 'Subscription', 'Location', 'SKU', 'Threat Intel', 'State', 'Policy', 'Deployment', 'Public IPs'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFw.map((f: AzureFirewallInstance) => (
                  <tr key={f.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{f.name}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{f.subscriptionName}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{f.location}</td>
                    <td className="px-3 py-3 text-cyan-300 whitespace-nowrap">{f.skuTier}</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${threatIntelColor(f.threatIntelMode)}`}>{f.threatIntelMode}</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${stateColor(f.provisioningState)}`}>{f.provisioningState}</td>
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{f.policyName ?? <span className="text-amber-400">Classic rules</span>}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{f.isVirtualHubBased ? 'Virtual Hub' : 'VNet'}</td>
                    <td className="px-3 py-3 text-slate-400 text-center whitespace-nowrap">{f.publicIpCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Firewall policies */}
      {data.policies.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Firewall Policies ({data.policies.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {['Policy Name', 'Subscription', 'Location', 'Threat Intel Mode', 'DNS Proxy', 'TLS Inspection', 'Linked Firewalls'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.policies.map((p: AzureFirewallPolicy) => (
                  <tr key={p.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{p.name}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{p.subscriptionName}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{p.location}</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${threatIntelColor(p.threatIntelMode)}`}>{p.threatIntelMode}</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${p.dnsProxyEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>{p.dnsProxyEnabled ? 'Enabled' : 'Disabled'}</td>
                    <td className={`px-3 py-3 whitespace-nowrap font-medium ${p.tlsInspectionEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>{p.tlsInspectionEnabled ? 'Enabled' : 'Disabled'}</td>
                    <td className="px-3 py-3 text-cyan-300 font-bold text-center whitespace-nowrap">{p.linkedFirewallCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
