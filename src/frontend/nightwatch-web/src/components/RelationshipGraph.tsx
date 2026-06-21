import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import type { GraphEdge, GraphNode } from '../types/dashboard';

// ── Azure icon URL imports ────────────────────────────────────────────────────
import vpnGatewayIcon     from '../assets/Icons/networking/10063-icon-service-Virtual-Network-Gateways.svg';
import localGatewayIcon   from '../assets/Icons/networking/10077-icon-service-Local-Network-Gateways.svg';
import onPremGatewayIcon  from '../assets/Icons/networking/10070-icon-service-On-Premises-Data-Gateways.svg';
import vnetIcon           from '../assets/Icons/networking/10061-icon-service-Virtual-Networks.svg';
import firewallIcon       from '../assets/Icons/networking/10084-icon-service-Firewalls.svg';
import appGatewayIcon     from '../assets/Icons/networking/10076-icon-service-Application-Gateways.svg';
import publicIpIcon       from '../assets/Icons/networking/10069-icon-service-Public-IP-Addresses.svg';
import nsgIcon            from '../assets/Icons/networking/10067-icon-service-Network-Security-Groups.svg';
import defenderIcon       from '../assets/Icons/security/10241-icon-service-Microsoft-Defender-for-Cloud.svg';
import detonationIcon     from '../assets/Icons/security/00378-icon-service-Detonation.svg';
import riskySigninsIcon   from '../assets/Icons/security/03341-icon-service-Entra-Identity-Risky-Signins.svg';
import globeWarningIcon   from '../assets/Icons/general/10809-icon-service-Globe-Warning.svg';
import subscriptionIcon   from '../assets/Icons/general/10002-icon-service-Subscriptions.svg';
import vmIcon             from '../assets/Icons/compute/10021-icon-service-Virtual-Machine.svg';
import sqlIcon            from '../assets/Icons/databases/10130-icon-service-SQL-Database.svg';
import storageIcon        from '../assets/Icons/storage/10086-icon-service-Storage-Accounts.svg';

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  title: string;
  heightClassName?: string;
  downloadFileName?: string;
}

export interface RelationshipGraphHandle {
  downloadPng: () => Promise<void>;
}

// ── Azure icon node label ─────────────────────────────────────────────────────

// ID-based icon overrides — used for well-known blast-radius node IDs so each
// resource category gets its real Azure icon even when the type is generic ("at-risk").
const ID_ICON: Record<string, string> = {
  'internet':    globeWarningIcon,
  'anyany-nsgs': nsgIcon,
  'public-ips':  publicIpIcon,
  'vnets':       vnetIcon,
  'vms':         vmIcon,
  'databases':   sqlIcon,
  'storage':     storageIcon,
  'scope':       defenderIcon,
};

function NodeIcon({ type, id }: { type: string; id: string }) {
  const size = 20;

  // ID-based lookup first (handles blast-radius nodes and subscription nodes)
  const idSrc = ID_ICON[id] ?? (id.startsWith('sub:') ? subscriptionIcon : undefined);
  if (idSrc) {
    return (
      <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6, flexShrink: 0 }}>
        <img src={idSrc} width={size} height={size} alt="" style={{ display: 'block' }} />
      </span>
    );
  }

  // Type-based fallback for all other nodes
  const src: string = (
    type === 'vpn-gateway'   ? vpnGatewayIcon   :
    type === 'local-gateway' ? localGatewayIcon  :
    type === 'onprem'        ? onPremGatewayIcon :
    type === 'vnet-remote'   ? vnetIcon          :
    type === 'firewall'      ? firewallIcon      :
    type === 'app-gateway'   ? appGatewayIcon    :
    type === 'internet'      ? globeWarningIcon  :
    type === 'exposed'       ? detonationIcon    :
    type === 'at-risk'       ? riskySigninsIcon  :
    type === 'safe'          ? defenderIcon      :
    type === 'public-ip'     ? publicIpIcon      :
    type === 'nsg'           ? nsgIcon           :
    type === 'vm'            ? vmIcon            :
    type === 'database'      ? sqlIcon           :
    type === 'storage'       ? storageIcon       :
    type === 'subscription'  ? subscriptionIcon  :
    vnetIcon  // default: VNet
  );
  return (
    <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6, flexShrink: 0 }}>
      <img src={src} width={size} height={size} alt="" style={{ display: 'block' }} />
    </span>
  );
}

// ── Left-to-right layered layout ──────────────────────────────────────────────

function computeLRLayout(nodeList: GraphNode[], edgeList: GraphEdge[]): Map<string, { x: number; y: number }> {
  const TYPE_LAYER: Record<string, number> = {
    'local-gateway': 0,
    'vpn-gateway':   1,
  };

  const outEdges  = new Map<string, string[]>();
  const inEdges   = new Map<string, string[]>();
  const peerEdges = new Map<string, string[]>();

  for (const n of nodeList) {
    outEdges.set(n.id, []);
    inEdges.set(n.id, []);
    peerEdges.set(n.id, []);
  }
  for (const e of edgeList) {
    const rel = e.relationship.toLowerCase();
    if (rel === 'peered') {
      peerEdges.get(e.source)?.push(e.target);
      peerEdges.get(e.target)?.push(e.source);
    } else {
      outEdges.get(e.source)?.push(e.target);
      inEdges.get(e.target)?.push(e.source);
    }
  }

  const peerDegree = (id: string) => peerEdges.get(id)?.length ?? 0;
  const nodeTypeOf  = (id: string) => nodeList.find(n => n.id === id)?.type ?? '';

  const layers = new Map<string, number>();

  for (const n of nodeList) {
    if (TYPE_LAYER[n.type] !== undefined) layers.set(n.id, TYPE_LAYER[n.type]);
  }

  for (const n of nodeList) {
    if (!layers.has(n.id)
      && (inEdges.get(n.id)?.length ?? 0) === 0
      && (peerEdges.get(n.id)?.length ?? 0) === 0
      && (outEdges.get(n.id)?.length ?? 0) > 0) {
      layers.set(n.id, 0);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [nodeId, layer] of layers) {
      for (const neighborId of outEdges.get(nodeId) ?? []) {
        const proposed = layer + 1;
        const existing = layers.get(neighborId);
        if ((existing === undefined || proposed > existing) && TYPE_LAYER[nodeTypeOf(neighborId)] === undefined) {
          layers.set(neighborId, proposed);
          changed = true;
        }
      }
    }
  }

  let peerChanged = true;
  while (peerChanged) {
    peerChanged = false;
    for (const n of nodeList) {
      const peers = peerEdges.get(n.id) ?? [];
      if (!layers.has(n.id) || peers.length === 0) continue;
      const myLayer = layers.get(n.id)!;
      const myDeg   = peerDegree(n.id);

      for (const peerId of peers) {
        if (TYPE_LAYER[nodeTypeOf(peerId)] !== undefined) continue;
        const peerDeg = peerDegree(peerId);
        const proposed = myDeg >= peerDeg ? myLayer + 1 : Math.max(0, myLayer - 1);
        const existing = layers.get(peerId);
        if (existing === undefined || proposed !== existing) {
          layers.set(peerId, proposed);
          peerChanged = true;
        }
      }
    }
  }

  for (const n of nodeList) {
    if (layers.has(n.id)) continue;
    const allNeighbours = [
      ...(outEdges.get(n.id) ?? []),
      ...(inEdges.get(n.id) ?? []),
      ...(peerEdges.get(n.id) ?? []),
    ];
    const firstAssigned = allNeighbours.find(id => layers.has(id));
    layers.set(n.id, firstAssigned !== undefined ? (layers.get(firstAssigned)! + 1) : 50);
  }

  const uniqueLayers = [...new Set(layers.values())].sort((a, b) => a - b);
  const remap        = new Map(uniqueLayers.map((v, i) => [v, i]));

  const byLayer = new Map<number, string[]>();
  for (const [id, rawLayer] of layers) {
    const layer = remap.get(rawLayer) ?? rawLayer;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(id);
  }

  const X_GAP = 260;
  const Y_GAP = 120;
  const positions = new Map<string, { x: number; y: number }>();

  for (const [layer, ids] of byLayer) {
    const x       = layer * X_GAP;
    const totalH  = (ids.length - 1) * Y_GAP;
    ids.forEach((id, i) => {
      positions.set(id, { x, y: i * Y_GAP - totalH / 2 + 250 });
    });
  }

  return positions;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const RelationshipGraph = forwardRef<RelationshipGraphHandle, RelationshipGraphProps>(
  function RelationshipGraph({ nodes, edges, title, heightClassName = 'h-[360px]', downloadFileName }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    const downloadPng = useCallback(async () => {
      if (!containerRef.current) return;
      const { toPng } = await import('html-to-image');
      try {
        const dataUrl = await toPng(containerRef.current, {
          backgroundColor: '#0f172a',
          pixelRatio: 2,
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${downloadFileName ?? (title ? title.replace(/\s+/g, '-').toLowerCase() : 'graph')}.png`;
        a.click();
      } catch (e) {
        console.error('Graph download failed', e);
      }
    }, [downloadFileName, title]);

    useImperativeHandle(ref, () => ({ downloadPng }), [downloadPng]);

    const dedupedEdges: GraphEdge[] = [];
    const seenEdgeKeys = new Set<string>();

    for (const edge of edges) {
      const relationship = edge.relationship.toLowerCase();
      const key = relationship === 'peered'
        ? `${relationship}|${[edge.source, edge.target].sort().join('|')}`
        : `${relationship}|${edge.source}|${edge.target}`;
      if (!seenEdgeKeys.has(key)) {
        seenEdgeKeys.add(key);
        dedupedEdges.push(edge);
      }
    }

    const positions = computeLRLayout(nodes, dedupedEdges);

    const nodeStyle = (type: string): React.CSSProperties => {
      switch (type) {
        case 'vpn-gateway':
          return { border: '1px solid rgba(245,158,11,0.6)', borderRadius: 12, padding: '8px 12px', background: 'rgba(120,53,15,0.4)', color: '#fde68a', minWidth: 130 };
        case 'local-gateway':
          return { border: '1px solid rgba(16,185,129,0.6)', borderRadius: 12, padding: '8px 12px', background: 'rgba(6,78,59,0.4)', color: '#6ee7b7', minWidth: 130 };
        case 'vnet-remote':
          return { border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '8px 12px', background: 'rgba(15,23,42,0.5)', color: '#94a3b8', minWidth: 130 };
        case 'internet':
          return { border: '2px solid rgba(251,191,36,0.85)', borderRadius: 12, padding: '8px 12px', background: 'rgba(120,53,15,0.65)', color: '#fde68a', minWidth: 150, fontWeight: 700 };
        case 'exposed':
          return { border: '2px solid rgba(239,68,68,0.8)', borderRadius: 12, padding: '8px 12px', background: 'rgba(127,29,29,0.55)', color: '#fca5a5', minWidth: 150 };
        case 'at-risk':
          return { border: '1px solid rgba(249,115,22,0.65)', borderRadius: 12, padding: '8px 12px', background: 'rgba(124,45,18,0.4)', color: '#fdba74', minWidth: 140 };
        case 'safe':
          return { border: '1px solid rgba(16,185,129,0.55)', borderRadius: 12, padding: '8px 12px', background: 'rgba(6,78,59,0.35)', color: '#6ee7b7', minWidth: 130 };
        default:
          return { border: '1px solid rgba(34,211,238,0.4)', borderRadius: 12, padding: '8px 12px', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0', minWidth: 130 };
      }
    };

    const flowNodes: Node[] = nodes.map((n) => ({
      id: n.id,
      data: {
        label: (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, lineHeight: 1.3 }}>
            <NodeIcon type={n.type} id={n.id} />
            <span>{n.label}</span>
          </div>
        ),
      },
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      style: nodeStyle(n.type),
    }));

    const flowEdges: Edge[] = dedupedEdges.map((e, index) => {
      const relationship = e.relationship.toLowerCase();
      const stroke =
        relationship === 'peered'           ? '#22d3ee' :
        relationship === 'attached-to'      ? '#f59e0b' :
        relationship === 'vpn-connection'   ? '#f97316' :
        relationship === 'vpn-vnet-to-vnet' ? '#a78bfa' :
        relationship === 'exposes'          ? '#ef4444' :
        relationship === 'compromises'      ? '#f43f5e' :
        relationship === 'traverses'        ? '#f97316' :
        relationship === 'reachable'        ? '#f59e0b' :
        relationship === 'accesses'         ? '#94a3b8' :
        relationship === 'contains'         ? '#22d3ee' :
        '#64748b';

      return {
        id: `${e.source}-${e.target}-${index}`,
        source: e.source,
        target: e.target,
        label: relationship === 'vpn-connection'   ? 'S2S'
             : relationship === 'vpn-vnet-to-vnet' ? 'V2V'
             : relationship === 'exposes'           ? 'exposes'
             : relationship === 'compromises'       ? 'compromises'
             : relationship === 'traverses'         ? 'traverses'
             : relationship === 'reachable'         ? 'reachable'
             : undefined,
        labelStyle:   { fill: stroke, fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: 'rgba(15,23,42,0.8)' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: stroke },
        animated: relationship === 'peered' || relationship === 'vpn-connection' || relationship === 'exposes' || relationship === 'compromises',
        style: { stroke, strokeWidth: relationship === 'exposes' || relationship === 'compromises' ? 2.5 : relationship === 'peered' ? 2 : 1.5 },
      };
    });

    return (
      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        {title ? (
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">{title}</h3>
            <button
              type="button"
              onClick={downloadPng}
              title="Download graph as PNG"
              className="flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-700/40 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-300"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PNG
            </button>
          </div>
        ) : (
          <div className="mb-3" />
        )}
        <div ref={containerRef} className={`${heightClassName} w-full rounded-xl border border-white/10`}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
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
    );
  }
);
