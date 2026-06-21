import { Fragment, useEffect, useState } from 'react';
import { DashboardState } from '../components/DashboardState';
import { PageBackButton } from '../components/PageBackButton';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { nightWatchClient } from '../api/client';
import type { NetworkTopologyDashboard } from '../types/dashboard';

interface NetworkTopologyPageProps {
  refreshTick: number;
}

export function NetworkTopologyPage({ refreshTick }: NetworkTopologyPageProps) {
  const [data, setData] = useState<NetworkTopologyDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedVnetId, setExpandedVnetId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading((prev) => prev || data === null);
      setLoadError(null);

      try {
        const response = await nightWatchClient.getNetworkTopologyDashboard(refreshTick);
        if (!isMounted) {
          return;
        }

        setData(response);
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load network topology dashboard.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [refreshTick]);

  const hasCoreData = Boolean(data);
  const state = <DashboardState isLoading={isLoading} loadError={loadError} hasCoreData={hasCoreData} />;
  if (state.props.children !== undefined || !data) {
    return state;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 shadow-2xl">
        <PageBackButton />
        <h2 className="mt-2 text-3xl font-black text-white">Environment Network Topology</h2>
        <p className="mt-2 text-sm text-slate-300">
          Single-pane view of discovered VNets, peering relationships, and VPN gateways across the current Azure scope.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
          VNets: {data.vnetCount} | Peerings: {data.peeringCount} | VPN Gateways: {data.vpnGatewayCount} | Connections: {data.connectionCount} | Local Gateways: {data.localGatewayCount}
        </p>
      </section>

      <RelationshipGraph
        title="VNet, Peering, and VPN Gateway Topology"
        nodes={data.nodes}
        edges={data.edges}
        heightClassName="h-[680px]"
      />

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Topology Notes</h3>
        <div className="space-y-2 text-sm text-slate-200">
          {data.notes.map((note, index) => (
            <p key={`${note}-${index}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">{note}</p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">VNets</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-400">
                <th className="px-3 py-2">Subscription</th>
                <th className="px-3 py-2">VNet</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Address Ranges</th>
                <th className="px-3 py-2">DNS</th>
                <th className="px-3 py-2">Private DNS Zones</th>
                <th className="px-3 py-2">Subnets</th>
              </tr>
            </thead>
            <tbody>
              {data.vnets.map((vnet) => {
                const isExpanded = expandedVnetId === vnet.resourceId;
                const subnetCount = vnet.subnets.length;

                return (
                  <Fragment key={vnet.resourceId}>
                    <tr className="border-b border-white/5">
                      <td className="px-3 py-2 text-slate-300">{vnet.subscriptionName || 'n/a'}</td>
                      <td className="px-3 py-2">
                        <button
                          className="text-cyan-300 hover:text-cyan-200"
                          onClick={() => setExpandedVnetId(isExpanded ? null : vnet.resourceId)}
                          type="button"
                        >
                          {isExpanded ? '▼' : '▶'} {vnet.name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{vnet.location || 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-300">{vnet.addressPrefixes.join(', ') || 'n/a'}</td>
                      <td className="px-3 py-2">
                        <DnsCell dnsServers={vnet.dnsServers} />
                      </td>
                      <td className="px-3 py-2">
                        {vnet.linkedPrivateDnsZones.length === 0 ? (
                          <span className="text-slate-500">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {vnet.linkedPrivateDnsZones.map((zone) => (
                              <span key={zone} className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-mono text-violet-300">
                                {zone}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{subnetCount}</td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-white/10 bg-slate-900/40">
                        <td className="px-3 py-3" colSpan={7}>
                          {subnetCount === 0 ? (
                            <p className="text-xs text-slate-400">No subnets discovered for this VNet.</p>
                          ) : (
                            <table className="min-w-full text-left text-xs text-slate-200">
                              <thead>
                                <tr className="border-b border-white/10 uppercase tracking-[0.12em] text-slate-400">
                                  <th className="px-2 py-2">Subnet</th>
                                  <th className="px-2 py-2">Address Prefix</th>
                                  <th className="px-2 py-2">NSG</th>
                                  <th className="px-2 py-2">Route Table</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vnet.subnets.map((subnet) => {
                                  const hasDangerousRules = subnet.nsgRules.some(isDangerousNsgRule);

                                  return (
                                    <Fragment key={subnet.resourceId}>
                                      <tr className="border-b border-white/5">
                                        <td className="px-2 py-2 text-cyan-200">{subnet.name}</td>
                                        <td className="px-2 py-2 text-slate-300">{subnet.addressPrefix || 'n/a'}</td>
                                        <td className="px-2 py-2 text-slate-300">{resourceNameFromId(subnet.networkSecurityGroupId) ?? 'None'}</td>
                                        <td className="px-2 py-2 text-slate-300">{resourceNameFromId(subnet.routeTableId) ?? 'None'}</td>
                                      </tr>
                                      <tr className="border-b border-white/10 bg-slate-900/30">
                                        <td className="px-2 py-2 align-top" colSpan={2}>
                                          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">NSG Rules</p>
                                          {subnet.nsgRules.length === 0 ? (
                                            <p className="text-slate-500">No NSG rules found.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {subnet.nsgRules.map((rule) => {
                                                const dangerous = isDangerousNsgRule(rule);
                                                const isAllow = rule.access.toLowerCase() === 'allow';
                                                return (
                                                  <div
                                                    key={`${subnet.resourceId}-nsg-${rule.name}-${rule.priority}`}
                                                    className={`rounded border px-2 py-1.5 text-[11px] ${dangerous ? 'border-rose-500/30 bg-rose-950/30' : 'border-white/10 bg-slate-950/70'}`}
                                                  >
                                                    {/* Header row: name + badges */}
                                                    <div className="mb-1.5 flex items-center gap-2 flex-wrap">
                                                      <span className="font-semibold text-slate-100">{rule.name}</span>
                                                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isAllow ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                        {rule.access}
                                                      </span>
                                                      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-300">{rule.direction}</span>
                                                      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-300">{rule.protocol}</span>
                                                      <span className="ml-auto text-[9px] text-slate-500">priority {rule.priority}</span>
                                                      {dangerous && (
                                                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-300">⚠ Dangerous</span>
                                                      )}
                                                    </div>
                                                    {/* Source → Destination flow */}
                                                    <div className="flex items-center gap-2">
                                                      <div className="flex-1 rounded bg-slate-800/60 px-2 py-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Source</p>
                                                        <p className="font-mono text-slate-200">{rule.source || '*'}</p>
                                                        <p className="text-slate-400">Port: <span className="font-mono text-slate-200">{rule.sourcePort || '*'}</span></p>
                                                      </div>
                                                      <div className="shrink-0 text-slate-400">→</div>
                                                      <div className="flex-1 rounded bg-slate-800/60 px-2 py-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Destination</p>
                                                        <p className="font-mono text-slate-200">{rule.destination || '*'}</p>
                                                        <p className="text-slate-400">Port: <span className="font-mono text-slate-200">{rule.destinationPort || '*'}</span></p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-2 py-2 align-top" colSpan={2}>
                                          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">Route Rules</p>
                                          {subnet.routeRules.length === 0 ? (
                                            <p className="text-slate-500">No route rules found.</p>
                                          ) : (
                                            <div className="space-y-1">
                                              {subnet.routeRules.map((rule) => (
                                                <div
                                                  key={`${subnet.resourceId}-route-${rule.name}`}
                                                  className="rounded border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px]"
                                                >
                                                  <p className="font-semibold text-slate-100">{rule.name}</p>
                                                  <p className="text-slate-300">
                                                    {rule.addressPrefix || 'n/a'}{' -> '}{rule.nextHopType || 'n/a'}
                                                    {rule.nextHopIpAddress ? ` (${rule.nextHopIpAddress})` : ''}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                      {hasDangerousRules ? (
                                        <tr className="border-b border-white/10 bg-rose-900/10">
                                          <td className="px-2 py-1.5 text-[11px] text-rose-300" colSpan={5}>
                                            ⚠ This subnet has NSG rules allowing unrestricted inbound traffic (Any source → Any destination).
                                          </td>
                                        </tr>
                                      ) : null}
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DnsCell({ dnsServers }: { dnsServers: string[] }) {
  const azureMagicIp = '168.63.129.16';

  if (dnsServers.length === 0) {
    return (
      <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
        Azure-provided
      </span>
    );
  }

  const isExplicitAzure = dnsServers.length === 1 && dnsServers[0] === azureMagicIp;
  if (isExplicitAzure) {
    return (
      <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
        Azure DNS (explicit)
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Custom</span>
      {dnsServers.map((ip) => (
        <p key={ip} className="font-mono text-[11px] text-slate-300">{ip}</p>
      ))}
    </div>
  );
}

function resourceNameFromId(resourceId: string | null): string | null {
  if (!resourceId) {
    return null;
  }

  const parts = resourceId.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? resourceId;
}

function isDangerousNsgRule(rule: {
  access: string;
  direction: string;
  source: string;
  sourcePort: string;
  destination: string;
  destinationPort: string;
}): boolean {
  const isInboundAllow = rule.access.toLowerCase() === 'allow' && rule.direction.toLowerCase() === 'inbound';
  const isAnySource = isWildcard(rule.source) && isWildcard(rule.sourcePort);
  const isAnyDestination = isWildcard(rule.destination) && isWildcard(rule.destinationPort);

  return isInboundAllow && isAnySource && isAnyDestination;
}

function isWildcard(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === '*' || normalized === 'any' || normalized === 'internet' || normalized === '0.0.0.0/0';
}
