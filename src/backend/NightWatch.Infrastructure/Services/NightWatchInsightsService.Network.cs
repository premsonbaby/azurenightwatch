using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using NightWatch.Infrastructure.Abstractions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed partial class NightWatchInsightsService
{
    public async Task<NetworkTopologyDashboardDto> GetNetworkTopologyDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions
            .Select(subscription => subscription.Id)
            .Where(IsUsableSubscriptionId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (subscriptionIds.Length == 0)
        {
            return new NetworkTopologyDashboardDto(
                tenantId,
                DateTimeOffset.UtcNow,
                0,
                0,
                0,
                0,
                0,
                Array.Empty<NetworkTopologyVnetDto>(),
                Array.Empty<GraphNode>(),
                Array.Empty<GraphEdge>(),
                ["No subscriptions available for topology discovery. Grant Reader access to monitored subscriptions."]);
        }

        var subscriptionNameById = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        var vnets = await QueryArgVnetsAsync(subscriptionIds, cancellationToken);
        var subnets = await QueryArgVnetSubnetsAsync(subscriptionIds, cancellationToken);
        var nsgRules = await QueryArgNetworkSecurityGroupRulesAsync(subscriptionIds, cancellationToken);
        var routeRules = await QueryArgRouteTableRulesAsync(subscriptionIds, cancellationToken);
        var peerings = await QueryArgPeeringsAsync(subscriptionIds, cancellationToken);
        var gateways = await QueryArgVpnGatewaysAsync(subscriptionIds, cancellationToken);
        var connections = await QueryArgVpnConnectionsAsync(subscriptionIds, cancellationToken);
        var localGateways = await QueryArgLocalNetworkGatewaysAsync(subscriptionIds, cancellationToken);
        var privateDnsLinks = await QueryArgPrivateDnsZoneLinksAsync(subscriptionIds, cancellationToken);

        var privateDnsZonesByVnetId = privateDnsLinks
            .GroupBy(link => link.VnetId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<string>)group.Select(l => l.ZoneName).OrderBy(z => z, StringComparer.OrdinalIgnoreCase).ToArray(),
                StringComparer.OrdinalIgnoreCase);

        var nsgRulesByNsgId = nsgRules
            .GroupBy(rule => rule.NetworkSecurityGroupId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<NetworkTopologySecurityRuleDto>)group
                    .OrderBy(rule => ParsePriority(rule.Priority))
                    .ThenBy(rule => rule.Name, StringComparer.OrdinalIgnoreCase)
                    .Select(rule => new NetworkTopologySecurityRuleDto(
                        rule.Name,
                        rule.Priority,
                        rule.Direction,
                        rule.Access,
                        rule.Protocol,
                        rule.Source,
                        rule.SourcePort,
                        rule.Destination,
                        rule.DestinationPort))
                    .ToArray(),
                StringComparer.OrdinalIgnoreCase);

        var routeRulesByRouteTableId = routeRules
            .GroupBy(rule => rule.RouteTableId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<NetworkTopologyRouteRuleDto>)group
                    .OrderBy(rule => rule.Name, StringComparer.OrdinalIgnoreCase)
                    .Select(rule => new NetworkTopologyRouteRuleDto(
                        rule.Name,
                        rule.AddressPrefix,
                        rule.NextHopType,
                        rule.NextHopIpAddress))
                    .ToArray(),
                StringComparer.OrdinalIgnoreCase);

        var subnetsByVnetId = subnets
            .GroupBy(subnet => subnet.VnetId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<NetworkTopologySubnetDto>)group
                    .OrderBy(subnet => subnet.SubnetName, StringComparer.OrdinalIgnoreCase)
                    .Select(subnet => new NetworkTopologySubnetDto(
                        subnet.SubnetId,
                        subnet.SubnetName,
                        subnet.AddressPrefix,
                        string.IsNullOrWhiteSpace(subnet.NetworkSecurityGroupId) ? null : subnet.NetworkSecurityGroupId,
                        string.IsNullOrWhiteSpace(subnet.RouteTableId) ? null : subnet.RouteTableId,
                        string.IsNullOrWhiteSpace(subnet.NetworkSecurityGroupId)
                            ? Array.Empty<NetworkTopologySecurityRuleDto>()
                            : nsgRulesByNsgId.GetValueOrDefault(subnet.NetworkSecurityGroupId, Array.Empty<NetworkTopologySecurityRuleDto>()),
                        string.IsNullOrWhiteSpace(subnet.RouteTableId)
                            ? Array.Empty<NetworkTopologyRouteRuleDto>()
                            : routeRulesByRouteTableId.GetValueOrDefault(subnet.RouteTableId, Array.Empty<NetworkTopologyRouteRuleDto>())))
                    .ToArray(),
                StringComparer.OrdinalIgnoreCase);

        var nodes = new Dictionary<string, GraphNode>(StringComparer.OrdinalIgnoreCase);
        var edges = new Dictionary<string, GraphEdge>(StringComparer.OrdinalIgnoreCase);

        foreach (var vnet in vnets)
        {
            var nodeId = NodeId("vnet", vnet.Id);
            var primaryPrefix = vnet.AddressPrefixes.FirstOrDefault();
            var baseLabel = string.IsNullOrWhiteSpace(vnet.Location) ? vnet.Name : $"{vnet.Name} ({vnet.Location})";
            nodes[nodeId] = new GraphNode(nodeId, string.IsNullOrWhiteSpace(primaryPrefix) ? baseLabel : $"{baseLabel} [{primaryPrefix}]", "vnet");
        }

        foreach (var peering in peerings)
        {
            var sourceNodeId = NodeId("vnet", peering.SourceVnetId);
            var targetNodeId = NodeId("vnet", peering.TargetVnetId);

            if (!nodes.ContainsKey(sourceNodeId))
            {
                nodes[sourceNodeId] = new GraphNode(sourceNodeId, peering.SourceVnetName, "vnet");
            }

            if (!nodes.ContainsKey(targetNodeId))
            {
                nodes[targetNodeId] = new GraphNode(targetNodeId, ExtractResourceNameFromId(peering.TargetVnetId) ?? "Remote VNet", "vnet-remote");
            }

            var edgeId = EdgeId(sourceNodeId, targetNodeId, "peered");
            if (!edges.ContainsKey(edgeId))
            {
                edges[edgeId] = new GraphEdge(sourceNodeId, targetNodeId, "peered");
            }
        }

        foreach (var gateway in gateways)
        {
            var gatewayNodeId = NodeId("vgw", gateway.Id);
            var label = string.IsNullOrWhiteSpace(gateway.VpnType)
                ? gateway.Name
                : $"{gateway.Name} ({gateway.VpnType})";

            nodes[gatewayNodeId] = new GraphNode(gatewayNodeId, label, "vpn-gateway");

            var attachedVnetId = GetVnetIdFromSubnetId(gateway.SubnetId);
            if (!string.IsNullOrWhiteSpace(attachedVnetId))
            {
                var vnetNodeId = NodeId("vnet", attachedVnetId);
                if (!nodes.ContainsKey(vnetNodeId))
                {
                    nodes[vnetNodeId] = new GraphNode(vnetNodeId, ExtractResourceNameFromId(attachedVnetId) ?? "VNet", "vnet");
                }

                var attachEdgeId = EdgeId(gatewayNodeId, vnetNodeId, "attached-to");
                edges[attachEdgeId] = new GraphEdge(gatewayNodeId, vnetNodeId, "attached-to");
            }
        }

        foreach (var lgw in localGateways)
        {
            var lgwNodeId = NodeId("lgw", lgw.Id);
            var lgwLabel = string.IsNullOrWhiteSpace(lgw.GatewayIpAddress)
                ? lgw.Name
                : $"{lgw.Name} ({lgw.GatewayIpAddress})";
            nodes[lgwNodeId] = new GraphNode(lgwNodeId, lgwLabel, "local-gateway");
        }

        foreach (var conn in connections)
        {
            var gwNodeId = NodeId("vgw", conn.VirtualNetworkGateway1Id);

            if (string.Equals(conn.ConnectionType, "IPsec", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(conn.LocalNetworkGateway2Id))
            {
                var lgwNodeId = NodeId("lgw", conn.LocalNetworkGateway2Id);
                if (!nodes.ContainsKey(gwNodeId))
                    nodes[gwNodeId] = new GraphNode(gwNodeId, ExtractResourceNameFromId(conn.VirtualNetworkGateway1Id) ?? "VPN Gateway", "vpn-gateway");
                if (!nodes.ContainsKey(lgwNodeId))
                    nodes[lgwNodeId] = new GraphNode(lgwNodeId, ExtractResourceNameFromId(conn.LocalNetworkGateway2Id) ?? "Local Gateway", "local-gateway");

                var edgeId = EdgeId(gwNodeId, lgwNodeId, "vpn-connection");
                if (!edges.ContainsKey(edgeId))
                    edges[edgeId] = new GraphEdge(gwNodeId, lgwNodeId, "vpn-connection");
            }
            else if (string.Equals(conn.ConnectionType, "Vnet2Vnet", StringComparison.OrdinalIgnoreCase) &&
                     !string.IsNullOrWhiteSpace(conn.VirtualNetworkGateway2Id))
            {
                var gw2NodeId = NodeId("vgw", conn.VirtualNetworkGateway2Id);
                if (!nodes.ContainsKey(gwNodeId))
                    nodes[gwNodeId] = new GraphNode(gwNodeId, ExtractResourceNameFromId(conn.VirtualNetworkGateway1Id) ?? "VPN Gateway", "vpn-gateway");
                if (!nodes.ContainsKey(gw2NodeId))
                    nodes[gw2NodeId] = new GraphNode(gw2NodeId, ExtractResourceNameFromId(conn.VirtualNetworkGateway2Id) ?? "VPN Gateway", "vpn-gateway");

                var edgeId = EdgeId(gwNodeId, gw2NodeId, "vpn-vnet-to-vnet");
                if (!edges.ContainsKey(edgeId))
                    edges[edgeId] = new GraphEdge(gwNodeId, gw2NodeId, "vpn-vnet-to-vnet");
            }
        }

        var notes = new List<string>();
        if (vnets.Count == 0)
        {
            notes.Add("No virtual networks were discovered in the currently scoped subscriptions.");
        }
        if (peerings.Count == 0)
        {
            notes.Add("No VNet peering relationships were discovered.");
        }
        if (gateways.Count == 0)
        {
            notes.Add("No VPN gateways were discovered.");
        }
        if (notes.Count == 0)
        {
            notes.Add($"Topology includes {vnets.Count} VNet(s), {peerings.Count} peering(s), {gateways.Count} VPN gateway(s), {connections.Count} connection(s), and {localGateways.Count} local network gateway(s).");
        }

        return new NetworkTopologyDashboardDto(
            tenantId,
            DateTimeOffset.UtcNow,
            vnets.Count,
            peerings.Count,
            gateways.Count,
            connections.Count,
            localGateways.Count,
            vnets
                .Select(vnet => new NetworkTopologyVnetDto(
                    vnet.Id,
                    vnet.Name,
                    vnet.SubscriptionId,
                    subscriptionNameById.GetValueOrDefault(vnet.SubscriptionId, "Unknown Subscription"),
                    vnet.Location,
                    vnet.AddressPrefixes,
                    vnet.DnsServers,
                    privateDnsZonesByVnetId.GetValueOrDefault(vnet.Id, Array.Empty<string>()),
                    subnetsByVnetId.GetValueOrDefault(vnet.Id, Array.Empty<NetworkTopologySubnetDto>())))
                .ToArray(),
            nodes.Values.ToArray(),
            edges.Values.ToArray(),
            notes);
    }

    public async Task<NetworkPerimeterDashboardDto> GetNetworkPerimeterDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new NetworkPerimeterDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, []);

        // Fetch NSG raw properties so we can parse securityRules in C# — avoids brittle
        // KQL mv-expand + nested dynamic property access that fails silently in ARG.
        const string pipQuery = @"resources
| where type =~ 'microsoft.network/publicipaddresses'
| project id, name, subscriptionId, associated=isnotempty(properties.ipConfiguration)";

        const string nsgQuery = @"resources
| where type =~ 'microsoft.network/networksecuritygroups'
| project id, name, subscriptionId, rules=properties.securityRules";

        var totalPips = 0; var unprotectedPips = 0; var dangerousNsgCount = 0; var openMgmtCount = 0;
        var exposed = new List<ExposedResourceDto>();

        try
        {
            using var pr = await azureResourceGraphClient.QueryResourcesAsync(pipQuery, subscriptionIds, null, cancellationToken);
            if (pr.RootElement.TryGetProperty("data", out var pd) && pd.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in pd.EnumerateArray())
                {
                    totalPips++;
                    var assoc = item.TryGetProperty("associated", out var av) && av.ValueKind == JsonValueKind.True;
                    if (!assoc) unprotectedPips++;
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Network perimeter PIP ARG query failed."); }

        try
        {
            using var nr = await azureResourceGraphClient.QueryResourcesAsync(nsgQuery, subscriptionIds, null, cancellationToken);
            if (nr.RootElement.TryGetProperty("data", out var nd) && nd.ValueKind == JsonValueKind.Array)
            {
                foreach (var nsgItem in nd.EnumerateArray())
                {
                    var nsgName = GetStringProperty(nsgItem, "name") ?? "unknown-nsg";
                    var subId = GetStringProperty(nsgItem, "subscriptionId") ?? "";

                    if (!nsgItem.TryGetProperty("rules", out var rulesEl)) continue;

                    // ARG objectArray format serialises dynamic columns (arrays/objects) as JSON strings.
                    // Parse the string back to a JsonDocument so we can walk the rules array.
                    JsonDocument? rulesDoc = null;
                    JsonElement rulesArray;
                    try
                    {
                        if (rulesEl.ValueKind == JsonValueKind.Array)
                        {
                            rulesArray = rulesEl;
                        }
                        else if (rulesEl.ValueKind == JsonValueKind.String)
                        {
                            var json = rulesEl.GetString() ?? "[]";
                            rulesDoc = JsonDocument.Parse(json);
                            rulesArray = rulesDoc.RootElement;
                        }
                        else continue;
                    }
                    catch { continue; }

                    try
                    {
                        if (rulesArray.ValueKind != JsonValueKind.Array) continue;

                        foreach (var rule in rulesArray.EnumerateArray())
                        {
                            if (!rule.TryGetProperty("properties", out var props)) continue;

                            var access = GetStringProperty(props, "access") ?? "";
                            var direction = GetStringProperty(props, "direction") ?? "";
                            if (!access.Equals("Allow", StringComparison.OrdinalIgnoreCase)) continue;
                            if (!direction.Equals("Inbound", StringComparison.OrdinalIgnoreCase)) continue;

                            var sourcePrefix = GetStringProperty(props, "sourceAddressPrefix") ?? "";
                            var portRange = GetStringProperty(props, "destinationPortRange") ?? "";

                            var sourcePrefixList = props.TryGetProperty("sourceAddressPrefixes", out var spEl) && spEl.ValueKind == JsonValueKind.Array
                                ? spEl.EnumerateArray().Select(e => e.GetString() ?? "").ToList()
                                : new List<string>();

                            var portRangeList = props.TryGetProperty("destinationPortRanges", out var prEl) && prEl.ValueKind == JsonValueKind.Array
                                ? prEl.EnumerateArray().Select(e => e.GetString() ?? "").ToList()
                                : new List<string>();

                            if (!IsInternetSourceRaw(sourcePrefix, sourcePrefixList)) continue;

                            var (isDangerous, portDisplay) = ClassifyPortRaw(portRange, portRangeList);
                            if (!isDangerous) continue;

                            dangerousNsgCount++;
                            var ruleName = GetStringProperty(rule, "name") ?? "unknown-rule";
                            var priority = props.TryGetProperty("priority", out var priEl) ? priEl.ToString() : "";
                            var isMgmt = IsMgmtPortRaw(portRange, portRangeList);
                            if (isMgmt) openMgmtCount++;
                            var riskLevel = IsWildcardPortRaw(portRange, portRangeList) ? "Critical" : "High";
                            var source = string.IsNullOrWhiteSpace(sourcePrefix)
                                ? string.Join(", ", sourcePrefixList)
                                : sourcePrefix;
                            var details = $"Priority {priority} · Source: {source} · Ports: {portDisplay}";
                            if (exposed.Count < 50)
                                exposed.Add(new ExposedResourceDto(
                                    ResourceName: $"{nsgName}  /  {ruleName}",
                                    ResourceType: "NSG Rule",
                                    SubscriptionName: subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                                    ExposureType: $"Inbound Allow — {DescribePort(portDisplay)} open to internet",
                                    RiskLevel: riskLevel,
                                    Details: details));
                        }
                    }
                    finally { rulesDoc?.Dispose(); }
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Network perimeter NSG ARG query failed."); }

        return new NetworkPerimeterDashboardDto(tenantId, DateTimeOffset.UtcNow, totalPips, unprotectedPips, openMgmtCount, dangerousNsgCount, exposed);
    }

    // ── Non-Prod Uptime Leakage ──────────────────────────────────────────────
    public async Task<ExpressRouteDashboardDto> GetExpressRouteDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new ExpressRouteDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, [], []);

        const string circuitQuery = @"resources
| where type =~ 'microsoft.network/expressroutecircuits'
| extend serviceProvider = tostring(properties.serviceProviderProperties.serviceProviderName)
| extend peeringLocation = tostring(properties.serviceProviderProperties.peeringLocation)
| extend bandwidthMbps = toint(properties.serviceProviderProperties.bandwidthInMbps)
| extend circuitState = tostring(properties.circuitProvisioningState)
| extend spState = tostring(properties.serviceProviderProvisioningState)
| extend skuTier = tostring(sku.tier)
| extend skuFamily = tostring(sku.family)
| project id, name, subscriptionId, location, serviceProvider, peeringLocation, bandwidthMbps, circuitState, spState, skuTier, skuFamily
| order by name asc";

        const string peeringQuery = @"resources
| where type =~ 'microsoft.network/expressroutecircuits/peerings'
| extend circuitId = tostring(split(id, '/peerings/')[0])
| extend peeringType = tostring(properties.peeringType)
| extend peeringState = tostring(properties.state)
| extend primaryPrefix = tostring(properties.primaryPeerAddressPrefix)
| extend secondaryPrefix = tostring(properties.secondaryPeerAddressPrefix)
| project id, name, subscriptionId, circuitId, peeringType, peeringState, primaryPrefix, secondaryPrefix
| order by circuitId asc, peeringType asc";

        var circuits = new List<ExpressRouteCircuitDto>();
        var peerings = new List<ExpressRoutePeeringDto>();

        try
        {
            using var circuitResult = await azureResourceGraphClient.QueryResourcesAsync(circuitQuery, subscriptionIds, null, cancellationToken);
            if (circuitResult.RootElement.TryGetProperty("data", out var circuitData) && circuitData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in circuitData.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var bw = item.TryGetProperty("bandwidthMbps", out var bwProp) && bwProp.ValueKind == JsonValueKind.Number ? bwProp.GetInt32() : 0;
                    circuits.Add(new ExpressRouteCircuitDto(
                        GetStringProperty(item, "id") ?? "",
                        GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                        GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "serviceProvider") ?? "",
                        GetStringProperty(item, "peeringLocation") ?? "",
                        bw,
                        GetStringProperty(item, "circuitState") ?? "",
                        GetStringProperty(item, "spState") ?? "",
                        GetStringProperty(item, "skuFamily") ?? "",
                        GetStringProperty(item, "skuTier") ?? ""));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "ExpressRoute circuit ARG query failed for tenant {TenantId}.", tenantId); }

        try
        {
            using var peeringResult = await azureResourceGraphClient.QueryResourcesAsync(peeringQuery, subscriptionIds, null, cancellationToken);
            if (peeringResult.RootElement.TryGetProperty("data", out var peeringData) && peeringData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in peeringData.EnumerateArray())
                {
                    var circuitId = GetStringProperty(item, "circuitId") ?? "";
                    var circuitName = circuits.FirstOrDefault(c => c.ResourceId.Equals(circuitId, StringComparison.OrdinalIgnoreCase))?.Name ?? circuitId;
                    peerings.Add(new ExpressRoutePeeringDto(
                        circuitId, circuitName,
                        GetStringProperty(item, "peeringType") ?? "",
                        GetStringProperty(item, "peeringState") ?? "",
                        GetStringProperty(item, "primaryPrefix") ?? "",
                        GetStringProperty(item, "secondaryPrefix") ?? ""));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "ExpressRoute peering ARG query failed for tenant {TenantId}.", tenantId); }

        var provisionedCount = circuits.Count(c => c.ServiceProviderProvisioningState.Equals("Provisioned", StringComparison.OrdinalIgnoreCase));

        return new ExpressRouteDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalCircuits: circuits.Count,
            ProvisionedCount: provisionedCount,
            NotProvisionedCount: circuits.Count - provisionedCount,
            TotalBandwidthMbps: circuits.Sum(c => c.BandwidthMbps),
            Circuits: circuits.ToArray(),
            Peerings: peerings.ToArray());
    }

    // ── Virtual WAN ───────────────────────────────────────────────────────────
    public async Task<VwanDashboardDto> GetVwanDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new VwanDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, [], []);

        const string vwanQuery = @"resources
| where type =~ 'microsoft.network/virtualwans'
| extend vwanType = tostring(properties.type)
| extend provState = tostring(properties.provisioningState)
| project id, name, subscriptionId, location, vwanType, provState
| order by name asc";

        const string hubQuery = @"resources
| where type =~ 'microsoft.network/virtualhubs'
| extend vwanId = tostring(properties.virtualWan.id)
| extend addressPrefix = tostring(properties.addressPrefix)
| extend provState = tostring(properties.provisioningState)
| extend hubRoutingPreference = tostring(properties.hubRoutingPreference)
| project id, name, subscriptionId, location, vwanId, addressPrefix, provState, hubRoutingPreference
| order by name asc";

        var vwans = new List<VwanDto>();
        var hubs = new List<VwanHubDto>();

        try
        {
            using var vwanResult = await azureResourceGraphClient.QueryResourcesAsync(vwanQuery, subscriptionIds, null, cancellationToken);
            if (vwanResult.RootElement.TryGetProperty("data", out var vwanData) && vwanData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in vwanData.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var vwanId = GetStringProperty(item, "id") ?? "";
                    vwans.Add(new VwanDto(
                        vwanId,
                        GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                        GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "vwanType") ?? "",
                        GetStringProperty(item, "provState") ?? "",
                        HubCount: 0));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "VWAN ARG query failed for tenant {TenantId}.", tenantId); }

        try
        {
            using var hubResult = await azureResourceGraphClient.QueryResourcesAsync(hubQuery, subscriptionIds, null, cancellationToken);
            if (hubResult.RootElement.TryGetProperty("data", out var hubData) && hubData.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in hubData.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    hubs.Add(new VwanHubDto(
                        GetStringProperty(item, "id") ?? "",
                        GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                        GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "vwanId") ?? "",
                        GetStringProperty(item, "addressPrefix") ?? "",
                        GetStringProperty(item, "provState") ?? "",
                        GetStringProperty(item, "hubRoutingPreference") ?? ""));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "VWAN hub ARG query failed for tenant {TenantId}.", tenantId); }

        // backfill hub counts on VWAN objects
        var hubsByVwan = hubs.GroupBy(h => h.VwanId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);
        var vwansWithCounts = vwans.Select(v => v with { HubCount = hubsByVwan.GetValueOrDefault(v.ResourceId, 0) }).ToArray();

        var connectedHubs = hubs.Count(h => h.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase));

        return new VwanDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalVwans: vwansWithCounts.Length,
            TotalHubs: hubs.Count,
            ConnectedHubs: connectedHubs,
            Vwans: vwansWithCounts,
            Hubs: hubs.ToArray());
    }
}
