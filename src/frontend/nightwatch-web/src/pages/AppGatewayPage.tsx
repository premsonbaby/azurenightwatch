import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, CartesianGrid,
} from 'recharts';
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { AppGatewayDashboard, AppGatewayInstance, AppGatewayListener } from '../types/dashboard';
import appGatewayIcon  from '../assets/Icons/networking/10076-icon-service-Application-Gateways.svg';
import publicIpIcon    from '../assets/Icons/networking/10069-icon-service-Public-IP-Addresses.svg';
import wafIcon         from '../assets/Icons/networking/10362-icon-service-Web-Application-Firewall-Policies(WAF).svg';
import lbIcon          from '../assets/Icons/networking/10062-icon-service-Load-Balancers.svg';
import globeIcon       from '../assets/Icons/general/10808-icon-service-Globe-Success.svg';

const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 11 };

const SEV_COLOR: Record<string, string> = {
  High: 'text-red-400 border-red-500/30 bg-red-950/30',
  Medium: 'text-amber-400 border-amber-500/30 bg-amber-950/30',
  Low: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30',
};

function fmtHour(h: string): string {
  try { return new Date(h).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return h; }
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function stateColor(s: string) {
  if (s.toLowerCase() === 'succeeded') return 'text-emerald-400';
  if (s.toLowerCase().includes('fail') || s.toLowerCase().includes('error')) return 'text-red-400';
  return 'text-amber-400';
}

function wafBadge(enabled: boolean, mode: string) {
  if (!enabled) return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400">Disabled</span>;
  if (mode.toLowerCase() === 'prevention') return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400">Prevention</span>;
  return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400">Detection</span>;
}

// ── App Gateway topology ──────────────────────────────────────────────────────

const COL = { internet: 0, pip: 240, agw: 490, listeners: 740, pools: 990 };
const MAX_LISTENERS = 8;

function AgwIcon({ src, size = 18 }: { src: string; size?: number }) {
  return <img src={src} width={size} height={size} alt="" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, flexShrink: 0 }} />;
}

function buildAppGwTopology(
  gateways: AppGatewayInstance[],
  allListeners: AppGatewayListener[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (gateways.length === 0) return { nodes, edges };

  // Pre-group listeners by gateway resource ID (case-insensitive)
  const listenersByGw = new Map<string, AppGatewayListener[]>();
  for (const l of allListeners) {
    const key = l.gatewayId.toLowerCase();
    if (!listenersByGw.has(key)) listenersByGw.set(key, []);
    listenersByGw.get(key)!.push(l);
  }

  // Calculate y-offset for each gateway so rows don't overlap when a gateway has many listeners
  const Y_GAP = 110;
  const gwOffsets: number[] = [];
  let currentY = 60;
  for (const gw of gateways) {
    gwOffsets.push(currentY);
    const lCount = Math.min((listenersByGw.get(gw.resourceId.toLowerCase()) ?? []).length || 1, MAX_LISTENERS + 1);
    currentY += Math.max(1, lCount) * Y_GAP + 30;
  }
  const totalHeight = currentY;
  const midY = totalHeight / 2;

  // Single internet source node — vertically centred across all gateways
  nodes.push({
    id: 'internet',
    data: {
      label: (
        <div style={{ fontSize: 12, lineHeight: 1.35 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700 }}>
            <AgwIcon src={globeIcon} />Internet / Clients
          </div>
        </div>
      ),
    },
    position: { x: COL.internet, y: midY - 22 },
    style: { border: '1px solid rgba(34,197,94,0.5)', borderRadius: 12, padding: '10px 14px', background: 'rgba(5,46,22,0.5)', color: '#86efac', minWidth: 155 },
  });

  gateways.forEach((gw, i) => {
    const gwListeners = (listenersByGw.get(gw.resourceId.toLowerCase()) ?? []).slice(0, MAX_LISTENERS);
    const extraCount = Math.max(0, (listenersByGw.get(gw.resourceId.toLowerCase()) ?? []).length - MAX_LISTENERS);
    const lCount = gwListeners.length + (extraCount > 0 ? 1 : 0);
    const gwBaseY = gwOffsets[i];
    // Gateway y = centre of its listener rows
    const gwY = gwBaseY + (Math.max(1, lCount) - 1) * Y_GAP / 2;

    const healthy = gw.provisioningState.toLowerCase() === 'succeeded';
    const wafColor = !gw.wafEnabled ? '#f87171' : gw.wafMode.toLowerCase() === 'prevention' ? '#34d399' : '#fbbf24';
    const wafLabel = !gw.wafEnabled ? 'WAF off' : gw.wafMode.toLowerCase() === 'prevention' ? 'WAF: Prevention' : 'WAF: Detection';
    const hasPip = gw.frontendPublicIpCount > 0;
    const agwId = `agw-${i}`;

    // ── Public IP node ──────────────────────────────────────────────────────
    if (hasPip) {
      const pipId = `pip-${i}`;
      nodes.push({
        id: pipId,
        data: {
          label: (
            <div style={{ fontSize: 12, lineHeight: 1.35 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                <AgwIcon src={publicIpIcon} />
                Public IP{gw.frontendPublicIpCount > 1 ? ` ×${gw.frontendPublicIpCount}` : ''}
              </div>
              <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>Frontend</div>
            </div>
          ),
        },
        position: { x: COL.pip, y: gwY },
        style: { border: '1px solid rgba(99,102,241,0.5)', borderRadius: 12, padding: '8px 12px', background: 'rgba(30,27,75,0.55)', color: '#c7d2fe', minWidth: 130 },
      });
      edges.push({
        id: `e-internet-pip-${i}`,
        source: 'internet',
        target: pipId,
        animated: true,
        style: { stroke: '#22d3ee', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9, color: '#22d3ee' },
      });
    }

    // ── App Gateway node ────────────────────────────────────────────────────
    nodes.push({
      id: agwId,
      data: {
        label: (
          <div style={{ fontSize: 12, lineHeight: 1.35 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, marginBottom: 2 }}>
              <AgwIcon src={appGatewayIcon} />{gw.name}
            </div>
            <div style={{ fontSize: 10, opacity: 0.65 }}>{gw.skuTier}{gw.autoscaleEnabled ? ' · Autoscale' : ''}</div>
            <div style={{ fontSize: 10, color: wafColor, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <AgwIcon src={wafIcon} size={12} />{wafLabel}
            </div>
          </div>
        ),
      },
      position: { x: COL.agw, y: gwY },
      style: {
        border: `1px solid ${healthy ? 'rgba(56,189,248,0.6)' : 'rgba(239,68,68,0.6)'}`,
        borderRadius: 12, padding: '10px 14px',
        background: healthy ? 'rgba(8,51,68,0.65)' : 'rgba(127,29,29,0.55)',
        color: '#e2e8f0', minWidth: 185,
      },
    });

    edges.push({
      id: `e-pip-agw-${i}`,
      source: hasPip ? `pip-${i}` : 'internet',
      target: agwId,
      style: { stroke: '#38bdf8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9, color: '#38bdf8' },
    });

    // ── Listener nodes ──────────────────────────────────────────────────────
    const listenerNodeIds: string[] = [];

    gwListeners.forEach((l, j) => {
      const lId = `listener-${i}-${j}`;
      listenerNodeIds.push(lId);
      const isHttps = l.protocol.toLowerCase() === 'https';
      const lColor = isHttps ? '#34d399' : '#94a3b8';
      const domainLabel = l.hostname === '*' ? '(any host)' : l.hostname;

      nodes.push({
        id: lId,
        data: {
          label: (
            <div style={{ fontSize: 11, lineHeight: 1.35 }}>
              <div style={{ fontWeight: 600, color: lColor, marginBottom: 1 }}>
                {l.protocol.toUpperCase()}
              </div>
              <div style={{ fontSize: 10, color: '#e2e8f0', wordBreak: 'break-all' }}>{domainLabel}</div>
              <div style={{ fontSize: 9, opacity: 0.5, marginTop: 1 }}>{l.listenerName}</div>
            </div>
          ),
        },
        position: { x: COL.listeners, y: gwBaseY + j * Y_GAP },
        style: {
          border: `1px solid ${isHttps ? 'rgba(52,211,153,0.4)' : 'rgba(148,163,184,0.25)'}`,
          borderRadius: 10, padding: '7px 10px',
          background: isHttps ? 'rgba(6,78,59,0.35)' : 'rgba(15,23,42,0.7)',
          minWidth: 160,
        },
      });

      edges.push({
        id: `e-agw-listener-${i}-${j}`,
        source: agwId,
        target: lId,
        style: { stroke: lColor, strokeWidth: 1, opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: lColor },
      });
    });

    // "+N more" overflow node
    if (extraCount > 0) {
      const overflowId = `listener-overflow-${i}`;
      listenerNodeIds.push(overflowId);
      nodes.push({
        id: overflowId,
        data: { label: <div style={{ fontSize: 11, color: '#94a3b8' }}>+{extraCount} more listener{extraCount !== 1 ? 's' : ''}</div> },
        position: { x: COL.listeners, y: gwBaseY + gwListeners.length * Y_GAP },
        style: { border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, padding: '6px 10px', background: 'rgba(15,23,42,0.5)', minWidth: 140 },
      });
      edges.push({
        id: `e-agw-overflow-${i}`,
        source: agwId,
        target: overflowId,
        style: { stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: '#475569' },
      });
    }

    // ── Backend Pools node — centred alongside listener group ───────────────
    if (gw.backendPoolCount > 0) {
      const poolId = `pools-${i}`;
      const poolY = gwBaseY + (Math.max(1, lCount) - 1) * Y_GAP / 2;
      nodes.push({
        id: poolId,
        data: {
          label: (
            <div style={{ fontSize: 12, lineHeight: 1.35 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                <AgwIcon src={lbIcon} />Pools ×{gw.backendPoolCount}
              </div>
              {gw.routingRuleCount > 0 && (
                <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>{gw.routingRuleCount} routing rule{gw.routingRuleCount !== 1 ? 's' : ''}</div>
              )}
            </div>
          ),
        },
        position: { x: COL.pools, y: poolY },
        style: { border: '1px solid rgba(148,163,184,0.3)', borderRadius: 12, padding: '8px 12px', background: 'rgba(15,23,42,0.65)', color: '#94a3b8', minWidth: 130 },
      });

      // Connect each listener to the pool
      const sourceIds = listenerNodeIds.length > 0 ? listenerNodeIds : [agwId];
      sourceIds.forEach((srcId, k) => {
        edges.push({
          id: `e-listener-pool-${i}-${k}`,
          source: srcId,
          target: poolId,
          style: { stroke: '#334155', strokeWidth: 1 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: '#334155' },
        });
      });
    }
  });

  return { nodes, edges };
}

export default function AppGatewayPage() {
  const [data, setData] = useState<AppGatewayDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    nightWatchClient.getAppGatewayDashboard()
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, []);

  // useMemo must be called unconditionally — before any early return
  const topology = useMemo(
    () => data ? buildAppGwTopology(data.gateways, data.listeners ?? []) : { nodes: [], edges: [] },
    [data],
  );

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const trafficChart = data.trafficTrend.map((p) => ({
    hour: fmtHour(p.hour),
    requests: p.requestCount,
    blocked: p.blockedCount,
  }));

  const topUrlsChart = data.topUrls.slice(0, 8).map((u) => ({
    name: u.url.length > 30 ? u.url.slice(0, 30) + '…' : u.url,
    count: u.requestCount,
  }));

  const topWafChart = data.topWafBlocks.slice(0, 8).map((w) => ({
    name: w.ruleId.length > 20 ? w.ruleId.slice(0, 20) + '…' : w.ruleId,
    count: w.hitCount,
    msg: w.message,
  }));

  const highInsights = data.insights.filter((i) => i.severity === 'High');

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Application Gateway</h2>
        <p className="mt-2 text-sm text-slate-300">
          WAF configuration, traffic analysis, and health across all Application Gateways
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalGateways} gateway{data.totalGateways !== 1 ? 's' : ''} ·{' '}
          {data.wafEnabledCount} WAF enabled · {data.wafPreventionCount} in prevention
          {highInsights.length > 0 && <span className="ml-2 text-red-400">· {highInsights.length} critical insight{highInsights.length !== 1 ? 's' : ''}</span>}
        </p>
      </section>

      {/* KPI cards — direct in flow */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: 'Total Gateways', value: data.totalGateways, accent: 'border-teal-400/25 bg-teal-500/5', text: 'text-teal-300' },
          { label: 'Healthy', value: data.healthyCount, accent: 'border-emerald-400/25 bg-emerald-500/5', text: 'text-emerald-300' },
          { label: 'Degraded', value: data.degradedCount, accent: data.degradedCount > 0 ? 'border-red-400/25 bg-red-500/5' : 'border-slate-700/40 bg-slate-800/30', text: data.degradedCount > 0 ? 'text-red-300' : 'text-slate-400' },
          { label: 'WAF Enabled', value: data.wafEnabledCount, accent: 'border-cyan-400/25 bg-cyan-500/5', text: 'text-cyan-300' },
          { label: 'Requests 24h', value: fmtK(data.totalRequests24h), accent: 'border-blue-400/25 bg-blue-500/5', text: 'text-blue-300' },
          { label: 'Blocked 24h', value: fmtK(data.totalBlocked24h), accent: data.totalBlocked24h > 0 ? 'border-red-400/25 bg-red-500/5' : 'border-slate-700/40 bg-slate-800/30', text: data.totalBlocked24h > 0 ? 'text-red-300' : 'text-slate-400' },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl border ${k.accent} p-5 text-center`}>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{k.label}</p>
            <p className={`mt-3 text-3xl font-black ${k.text}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Topology diagram */}
      {data.gateways.length > 0 && (
        <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Gateway Topology</h3>
          <div className="h-[420px] w-full rounded-xl border border-white/10">
            <ReactFlow
              nodes={topology.nodes}
              edges={topology.edges}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Controls showInteractive={false} />
              <Background gap={20} size={1} color="#1e293b" />
            </ReactFlow>
          </div>
        </section>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Insights</h3>
          <div className="space-y-2">
            {data.insights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-xl border p-3 ${SEV_COLOR[ins.severity] ?? 'border-slate-700/40 bg-slate-800/20 text-slate-300'}`}>
                <span className="mt-0.5 shrink-0 text-xs font-bold uppercase tracking-wider opacity-80">{ins.severity}</span>
                <p className="text-sm">{ins.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Traffic + WAF charts */}
      {data.hasLogAnalyticsData && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">24h Traffic & WAF Blocks</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficChart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="agReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="agBlk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="requests" stroke="#14b8a6" strokeWidth={2} fill="url(#agReq)" name="Requests" />
                <Area type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} fill="url(#agBlk)" name="WAF Blocked" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Top URLs + Top WAF Blocks */}
      {data.hasLogAnalyticsData && (topUrlsChart.length > 0 || topWafChart.length > 0) && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Top URLs & WAF Blocks</h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {topUrlsChart.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-slate-400">Top Requested URLs (24h)</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topUrlsChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {topUrlsChart.map((_, i) => (
                          <Cell key={i} fill={['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#f59e0b', '#10b981'][i % 8]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {topWafChart.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-slate-400">Top WAF Blocked Rules (24h)</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topWafChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, p) => [v, p.payload.msg || 'Rule hit']} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {topWafChart.map((_, i) => (
                          <Cell key={i} fill={['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'][i % 8]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Gateway inventory table */}
      {data.gateways.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Gateway Inventory ({data.gateways.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Subscription</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Location</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">WAF</th>
                  <th className="px-3 py-2 font-medium hidden lg:table-cell">SSL Policy</th>
                  <th className="px-3 py-2 font-medium hidden xl:table-cell">Pools</th>
                  <th className="px-3 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {data.gateways.map((gw) => (
                  <tr key={gw.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-white">{gw.name}</p>
                      {gw.autoscaleEnabled && <p className="text-[10px] text-cyan-400">Autoscale</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden sm:table-cell">{gw.subscriptionName}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden md:table-cell">{gw.location}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      <span>{gw.skuTier}</span>
                      {gw.skuCapacity > 0 && <span className="ml-1 text-slate-500">×{gw.skuCapacity}</span>}
                    </td>
                    <td className="px-3 py-2.5">{wafBadge(gw.wafEnabled, gw.wafMode)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden lg:table-cell">
                      {gw.sslPolicyName || <span className="text-amber-400">None</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden xl:table-cell">{gw.backendPoolCount}</td>
                    <td className={`px-3 py-2.5 text-xs font-medium ${stateColor(gw.provisioningState)}`}>{gw.provisioningState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.gateways.length === 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-10 text-center">
          <p className="text-3xl">🔀</p>
          <p className="mt-3 text-lg font-semibold text-slate-200">No Application Gateways Found</p>
          <p className="mt-2 text-sm text-slate-400">No Application Gateways were detected in this tenant.</p>
        </section>
      )}
    </div>
  );
}
