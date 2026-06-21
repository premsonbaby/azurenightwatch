import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { nightWatchClient } from '../api/client';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import type { VpnGatewayConnection, VpnGatewayDashboard, VpnGatewayInstance } from '../types/dashboard';
import vpnGatewayIcon    from '../assets/Icons/networking/10063-icon-service-Virtual-Network-Gateways.svg';
import localGatewayIcon  from '../assets/Icons/networking/10077-icon-service-Local-Network-Gateways.svg';
import vnetIcon          from '../assets/Icons/networking/10061-icon-service-Virtual-Networks.svg';

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

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

// ── VPN Topology icons ────────────────────────────────────────────────────────

function VpnIcon({ kind }: { kind: 'gateway' | 'onprem' | 'vnet' | 'placeholder' }) {
  const s = 18;
  const src = kind === 'gateway' ? vpnGatewayIcon : kind === 'onprem' ? localGatewayIcon : vnetIcon;
  if (kind === 'placeholder') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
      <circle cx="12" cy="12" r="9" fill="rgba(100,116,139,0.2)" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 2"/>
    </svg>
  );
  return <img src={src} width={s} height={s} alt="" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />;
}

// ── Layout: explicit left → gateway → right columns ───────────────────────────
// Column 0 (x=0):   On-premises endpoints  (IPsec/S2S local network gateways)
// Column 1 (x=310): VPN Gateways
// Column 2 (x=620): Remote Azure VNets     (VNet2VNet)

function buildTopologyGraph(
  gateways: VpnGatewayInstance[],
  connections: VpnGatewayConnection[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const COL = { onprem: 0, gateway: 310, vnet: 620 };
  const Y_GAP = 130;
  const center = (count: number, idx: number) => (idx - (count - 1) / 2) * Y_GAP + 260;

  // Separate connections into on-prem (IPsec/S2S) and vnet-to-vnet
  const ipsecConns  = connections.filter(c => c.connectionType !== 'Vnet2Vnet');
  const vnetConns   = connections.filter(c => c.connectionType === 'Vnet2Vnet');

  // ── Gateway nodes — centre column ─────────────────────────────────────────
  gateways.forEach((gw, i) => {
    const healthy = gw.provisioningState === 'Succeeded';
    nodes.push({
      id: `gw-${gw.resourceId}`,
      data: {
        label: (
          <div style={{ lineHeight: 1.35, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, marginBottom: 2 }}>
              <VpnIcon kind="gateway" />{gw.name}
            </div>
            <div style={{ fontSize: 10, opacity: 0.65 }}>{gw.skuName}{gw.generation ? ` · ${gw.generation}` : ''}</div>
            {gw.bgpEnabled && <div style={{ fontSize: 10, color: '#34d399' }}>BGP ASN {gw.bgpAsn}</div>}
          </div>
        ),
      },
      position: { x: COL.gateway, y: center(gateways.length, i) },
      style: {
        border: `1px solid ${healthy ? 'rgba(99,102,241,0.7)' : 'rgba(239,68,68,0.6)'}`,
        borderRadius: 12,
        padding: '10px 14px',
        background: healthy ? 'rgba(30,27,75,0.75)' : 'rgba(127,29,29,0.55)',
        color: '#c7d2fe',
        minWidth: 170,
      },
    });
  });

  // Helper: find owning gateway for a connection (by name substring match, fallback to first)
  const ownerGwId = (conn: VpnGatewayConnection): string => {
    const matched = gateways.find(gw =>
      conn.name.toLowerCase().startsWith(gw.name.toLowerCase()) ||
      conn.name.toLowerCase().includes(`-${gw.name.toLowerCase()}-`) ||
      conn.name.toLowerCase().includes(gw.name.toLowerCase().slice(0, 6))
    );
    return matched ? `gw-${matched.resourceId}` : `gw-${gateways[0]?.resourceId ?? ''}`;
  };

  // ── On-premises nodes — left column ───────────────────────────────────────
  ipsecConns.forEach((conn, i) => {
    const isConnected = conn.connectionStatus.toLowerCase() === 'connected';
    const nodeId = `onprem-${i}`;
    const label = conn.localNetworkGatewayName || conn.name;
    const ip = conn.localNetworkGatewayIp;

    nodes.push({
      id: nodeId,
      data: {
        label: (
          <div style={{ lineHeight: 1.35, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, marginBottom: 2 }}>
              <VpnIcon kind="onprem" />{label}
            </div>
            {ip && <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 1 }}>{ip}</div>}
            {conn.connectionStatus && conn.connectionStatus.toLowerCase() !== 'unknown' && (
              <div style={{ fontSize: 10, color: isConnected ? '#34d399' : '#f87171' }}>
                {conn.connectionStatus}
              </div>
            )}
          </div>
        ),
      },
      position: { x: COL.onprem, y: center(ipsecConns.length || 1, i) },
      style: {
        border: `1px solid ${isConnected ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.5)'}`,
        borderRadius: 12,
        padding: '8px 12px',
        background: isConnected ? 'rgba(6,78,59,0.4)' : 'rgba(127,29,29,0.35)',
        color: isConnected ? '#6ee7b7' : '#fca5a5',
        minWidth: 150,
      },
    });

    const gwId = ownerGwId(conn);
    edges.push({
      id: `edge-onprem-${i}`,
      source: nodeId,
      target: gwId,
      animated: isConnected,
      label: 'S2S IPsec',
      labelStyle: { fill: isConnected ? '#34d399' : '#f87171', fontSize: 9, fontWeight: 600 },
      labelBgStyle: { fill: 'rgba(15,23,42,0.85)' },
      style: { stroke: isConnected ? '#34d399' : '#ef4444', strokeWidth: 1.5, strokeDasharray: isConnected ? undefined : '5 4' },
      markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9, color: isConnected ? '#34d399' : '#ef4444' },
    });
  });

  // ── Remote VNet nodes — right column ──────────────────────────────────────
  vnetConns.forEach((conn, i) => {
    const isConnected = conn.connectionStatus.toLowerCase() === 'connected';
    const nodeId = `vnet-${i}`;
    const label = conn.remoteVnetName || conn.name;

    nodes.push({
      id: nodeId,
      data: {
        label: (
          <div style={{ lineHeight: 1.35, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, marginBottom: 2 }}>
              <VpnIcon kind="vnet" />{label}
            </div>
            <div style={{ fontSize: 10, color: isConnected ? '#34d399' : '#f87171' }}>
              VNet-to-VNet · {conn.connectionStatus}
            </div>
          </div>
        ),
      },
      position: { x: COL.vnet, y: center(vnetConns.length || 1, i) },
      style: {
        border: `1px solid ${isConnected ? 'rgba(34,211,238,0.5)' : 'rgba(239,68,68,0.5)'}`,
        borderRadius: 12,
        padding: '8px 12px',
        background: isConnected ? 'rgba(8,51,68,0.55)' : 'rgba(127,29,29,0.35)',
        color: isConnected ? '#67e8f9' : '#fca5a5',
        minWidth: 150,
      },
    });

    const gwId = ownerGwId(conn);
    edges.push({
      id: `edge-vnet-${i}`,
      source: gwId,
      target: nodeId,
      animated: isConnected,
      label: 'V2V',
      labelStyle: { fill: isConnected ? '#22d3ee' : '#f87171', fontSize: 9, fontWeight: 600 },
      labelBgStyle: { fill: 'rgba(15,23,42,0.85)' },
      style: { stroke: isConnected ? '#22d3ee' : '#ef4444', strokeWidth: 1.5, strokeDasharray: isConnected ? undefined : '5 4' },
      markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9, color: isConnected ? '#22d3ee' : '#ef4444' },
    });
  });

  // ── Placeholder when a gateway has zero connections ───────────────────────
  gateways.forEach((gw, i) => {
    const gwId = `gw-${gw.resourceId}`;
    const hasAny = connections.some(c => ownerGwId(c) === gwId);
    if (!hasAny) {
      const pid = `noconn-${i}`;
      nodes.push({
        id: pid,
        data: { label: <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, opacity: 0.55 }}><VpnIcon kind="placeholder" />No connections</div> },
        position: { x: COL.vnet, y: center(gateways.length, i) },
        style: { border: '1px dashed rgba(148,163,184,0.3)', borderRadius: 10, padding: '8px 14px', background: 'rgba(15,23,42,0.35)', color: '#94a3b8', minWidth: 140 },
      });
      edges.push({
        id: `edge-noconn-${i}`,
        source: gwId,
        target: pid,
        style: { stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' },
      });
    }
  });

  return { nodes, edges };
}

function stateColor(s: string) {
  if (s.toLowerCase() === 'succeeded') return 'text-emerald-400';
  if (s.toLowerCase().includes('fail') || s.toLowerCase().includes('error')) return 'text-red-400';
  return 'text-amber-400';
}

function connStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'connected') return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400">Connected</span>;
  if (s === 'notconnected') return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400">Not Connected</span>;
  return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-slate-700/50 text-slate-400">{status}</span>;
}

export default function VpnGatewayPage() {
  const [data, setData] = useState<VpnGatewayDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    nightWatchClient.getVpnGatewayDashboard()
      .then((d) => { if (isMounted) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (isMounted) { setLoadError(e instanceof Error ? e.message : 'Failed to load.'); setIsLoading(false); } });
    return () => { isMounted = false; };
  }, []);

  const topology = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return buildTopologyGraph(data.gateways, data.connections);
  }, [data]);

  if (isLoading || loadError || !data) {
    return <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={!!data} />;
  }

  const tunnelChart = data.tunnelTrend.map((p) => ({
    hour: fmtHour(p.hour),
    in: p.bytesIn,
    out: p.bytesOut,
  }));

  const highInsights = data.insights.filter((i) => i.severity === 'High');

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">VPN Gateway</h2>
        <p className="mt-2 text-sm text-slate-300">
          VPN Gateway inventory, connection health, BGP configuration, and tunnel traffic
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          {data.totalGateways} gateway{data.totalGateways !== 1 ? 's' : ''} ·{' '}
          {data.totalConnections} connection{data.totalConnections !== 1 ? 's' : ''} ·{' '}
          {data.connectedTunnels} connected
          {highInsights.length > 0 && <span className="ml-2 text-red-400">· {highInsights.length} critical insight{highInsights.length !== 1 ? 's' : ''}</span>}
        </p>
      </section>

      {/* KPI cards — direct in flow */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Total Gateways', value: data.totalGateways, accent: 'border-indigo-400/25 bg-indigo-500/5', text: 'text-indigo-300' },
          { label: 'Healthy', value: data.healthyCount, accent: 'border-emerald-400/25 bg-emerald-500/5', text: 'text-emerald-300' },
          { label: 'Degraded', value: data.degradedCount, accent: data.degradedCount > 0 ? 'border-red-400/25 bg-red-500/5' : 'border-slate-700/40 bg-slate-800/30', text: data.degradedCount > 0 ? 'text-red-300' : 'text-slate-400' },
          { label: 'Connections', value: data.totalConnections, accent: 'border-cyan-400/25 bg-cyan-500/5', text: 'text-cyan-300' },
          { label: 'Connected', value: data.connectedTunnels, accent: 'border-teal-400/25 bg-teal-500/5', text: 'text-teal-300' },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl border ${k.accent} p-5 text-center`}>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{k.label}</p>
            <p className={`mt-3 text-3xl font-black ${k.text}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Topology diagram */}
      {data.gateways.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">VPN Topology</h3>
          <div className="h-[380px] w-full rounded-xl border border-white/10 overflow-hidden">
            <ReactFlow
              nodes={topology.nodes}
              edges={topology.edges}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Controls showInteractive={false} />
              <Background gap={20} size={1} color="#1e293b" />
            </ReactFlow>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-400/70"></span>VPN Gateway</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400/70"></span>Connected tunnel</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400/70"></span>Disconnected tunnel</span>
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

      {/* Tunnel traffic chart */}
      {data.hasLogAnalyticsData && tunnelChart.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">24h Tunnel Traffic</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tunnelChart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="vpnIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="vpnOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => fmtBytes(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => typeof v === 'number' ? fmtBytes(v) : String(v ?? '')} />
                <Area type="monotone" dataKey="in" stroke="#6366f1" strokeWidth={2} fill="url(#vpnIn)" name="Bytes In" />
                <Area type="monotone" dataKey="out" stroke="#06b6d4" strokeWidth={2} fill="url(#vpnOut)" name="Bytes Out" />
              </AreaChart>
            </ResponsiveContainer>
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
                  <th className="px-3 py-2 font-medium hidden lg:table-cell">Gen</th>
                  <th className="px-3 py-2 font-medium hidden lg:table-cell">BGP</th>
                  <th className="px-3 py-2 font-medium hidden xl:table-cell">Active-Active</th>
                  <th className="px-3 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {data.gateways.map((gw) => (
                  <tr key={gw.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-white">{gw.name}</p>
                      <p className="text-[10px] text-slate-500">{gw.gatewayType} · {gw.vpnType}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden sm:table-cell">{gw.subscriptionName}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden md:table-cell">{gw.location}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{gw.skuName}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden lg:table-cell">{gw.generation || '—'}</td>
                    <td className="px-3 py-2.5 text-xs hidden lg:table-cell">
                      <span className={gw.bgpEnabled ? 'text-emerald-400' : 'text-slate-500'}>
                        {gw.bgpEnabled ? `Yes (ASN ${gw.bgpAsn})` : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs hidden xl:table-cell">
                      <span className={gw.activeActiveEnabled ? 'text-emerald-400' : 'text-slate-500'}>
                        {gw.activeActiveEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-xs font-medium ${stateColor(gw.provisioningState)}`}>{gw.provisioningState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Connections table */}
      {data.connections.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            VPN Connections ({data.connections.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-2 font-medium">Connection</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Subscription</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">BGP</th>
                  <th className="px-3 py-2 font-medium hidden lg:table-cell">Remote</th>
                </tr>
              </thead>
              <tbody>
                {data.connections.map((conn) => (
                  <tr key={conn.resourceId} className="border-b border-white/5 transition hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 font-medium text-white">{conn.name}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden sm:table-cell">{conn.subscriptionName}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{conn.connectionType}</td>
                    <td className="px-3 py-2.5">{connStatusBadge(conn.connectionStatus)}</td>
                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">
                      <span className={conn.bgpEnabled ? 'text-emerald-400' : 'text-slate-500'}>
                        {conn.bgpEnabled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 hidden lg:table-cell">
                      {conn.localNetworkGatewayName || conn.remoteVnetName || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.gateways.length === 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-10 text-center">
          <p className="text-3xl">🔒</p>
          <p className="mt-3 text-lg font-semibold text-slate-200">No VPN Gateways Found</p>
          <p className="mt-2 text-sm text-slate-400">No VPN Gateways were detected in this tenant.</p>
        </section>
      )}
    </div>
  );
}
