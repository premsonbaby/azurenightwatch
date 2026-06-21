using System.Text.Json;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Contracts;

namespace NightWatch.Infrastructure.Services;

public sealed partial class NightWatchInsightsService
{
    public async Task<VpnGatewayDashboardDto> GetVpnGatewayDashboardAsync(
        string tenantId, CancellationToken cancellationToken)
    {
        try
        {
            var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
            var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId)
                .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

            if (subscriptionIds.Length == 0)
                return new VpnGatewayDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, false, [], [], [], []);

            // ── ARG: VPN Gateways ─────────────────────────────────────────────
            const string gwQuery = @"resources
| where type == 'microsoft.network/virtualnetworkgateways'
| extend
    skuName      = tostring(properties.sku.name),
    generation   = tostring(properties.vpnGatewayGeneration),
    gatewayType  = tostring(properties.gatewayType),
    vpnType      = tostring(properties.vpnType),
    bgpSettings  = properties.bgpSettings,
    activeActive = tobool(properties.activeActive),
    provState    = tostring(properties.provisioningState)
| extend
    bgpEnabled   = isnotnull(bgpSettings),
    bgpAsn       = tolong(bgpSettings.asn)
| project
    id, name, subscriptionId, location,
    skuName, generation, gatewayType, vpnType,
    bgpEnabled, bgpAsn, activeActive, provState
| order by name asc";

            var gateways = new List<VpnGatewayInstanceDto>();

            try
            {
                using var gwResult = await azureResourceGraphClient.QueryResourcesAsync(gwQuery, subscriptionIds, null, cancellationToken);
                if (gwResult.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        try
                        {
                            var subId = GetStringProperty(item, "subscriptionId") ?? "";
                            gateways.Add(new VpnGatewayInstanceDto(
                                ResourceId:          GetStringProperty(item, "id") ?? "",
                                Name:                GetStringProperty(item, "name") ?? "",
                                SubscriptionName:    subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                                Location:            GetStringProperty(item, "location") ?? "",
                                SkuName:             GetStringProperty(item, "skuName") ?? "",
                                Generation:          GetStringProperty(item, "generation") ?? "",
                                GatewayType:         GetStringProperty(item, "gatewayType") ?? "",
                                VpnType:             GetStringProperty(item, "vpnType") ?? "",
                                BgpEnabled:          item.TryGetProperty("bgpEnabled", out var bgp) && bgp.ValueKind == JsonValueKind.True,
                                BgpAsn:              item.TryGetProperty("bgpAsn", out var asn) && asn.ValueKind == JsonValueKind.Number ? asn.GetInt64() : 0L,
                                ActiveActiveEnabled: item.TryGetProperty("activeActive", out var aa) && aa.ValueKind == JsonValueKind.True,
                                ProvisioningState:   GetStringProperty(item, "provState") ?? "",
                                ConnectionCount:     0));
                        }
                        catch { /* skip malformed row */ }
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "VPN Gateway ARG query failed for tenant {TenantId}.", tenantId); }

            // ── ARG: VPN Connections ──────────────────────────────────────────
            const string connQuery = @"resources
| where type == 'microsoft.network/connections'
| extend
    connType   = tostring(properties.connectionType),
    connStatus = tostring(properties.connectionStatus),
    bgpEnabled = tobool(properties.enableBgp),
    lngId      = tostring(properties.localNetworkGateway2.id),
    vnetGw1Id  = tostring(properties.virtualNetworkGateway1.id),
    remoteVnet = tostring(properties.virtualNetworkGateway2.id)
| project
    id, name, subscriptionId, connType, connStatus, bgpEnabled, lngId, vnetGw1Id, remoteVnet
| order by name asc";

            // ── ARG: Local Network Gateways (for on-premises IP address) ─────────
            var lgwIpById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var lgws = await QueryArgLocalNetworkGatewaysAsync(subscriptionIds, cancellationToken);
                foreach (var lgw in lgws)
                    if (!string.IsNullOrWhiteSpace(lgw.Id))
                        lgwIpById[lgw.Id] = lgw.GatewayIpAddress;
            }
            catch (Exception ex) { logger.LogWarning(ex, "LGW IP ARG query failed for tenant {TenantId}.", tenantId); }

            var connections = new List<VpnGatewayConnectionDto>();

            try
            {
                using var connResult = await azureResourceGraphClient.QueryResourcesAsync(connQuery, subscriptionIds, null, cancellationToken);
                if (connResult.RootElement.TryGetProperty("data", out var connData) && connData.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in connData.EnumerateArray())
                    {
                        try
                        {
                            var subId = GetStringProperty(item, "subscriptionId") ?? "";
                            var lngFull = GetStringProperty(item, "lngId") ?? "";
                            var remoteFull = GetStringProperty(item, "remoteVnet") ?? "";
                            var gwId = GetStringProperty(item, "vnetGw1Id") ?? "";

                            connections.Add(new VpnGatewayConnectionDto(
                                ResourceId:              GetStringProperty(item, "id") ?? "",
                                Name:                    GetStringProperty(item, "name") ?? "",
                                SubscriptionName:        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                                ConnectionType:          GetStringProperty(item, "connType") ?? "",
                                ConnectionStatus:        GetStringProperty(item, "connStatus") ?? "Unknown",
                                BgpEnabled:              item.TryGetProperty("bgpEnabled", out var bgp) && bgp.ValueKind == JsonValueKind.True,
                                LocalNetworkGatewayName: GetResourceNameFromId(lngFull),
                                LocalNetworkGatewayIp:   lgwIpById.GetValueOrDefault(lngFull, ""),
                                RemoteVnetName:          GetResourceNameFromId(remoteFull)));

                            // Update connection count on parent gateway
                            var gwMatch = gateways.FindIndex(g => g.ResourceId.Equals(gwId, StringComparison.OrdinalIgnoreCase));
                            if (gwMatch >= 0)
                                gateways[gwMatch] = gateways[gwMatch] with { ConnectionCount = gateways[gwMatch].ConnectionCount + 1 };
                        }
                        catch { /* skip malformed row */ }
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "VPN Connection ARG query failed for tenant {TenantId}.", tenantId); }

            // ── Log Analytics: tunnel traffic ─────────────────────────────────
            var tunnelTrend = new List<VpnGatewayTunnelPointDto>();
            bool hasLaData = false;

            var workspaceIds = operationsScopeService.GetCurrent().LogAnalyticsWorkspaceIds;

            if (workspaceIds.Count > 0)
            {
                const string tunnelKql = @"let t = ago(24h);
union isfuzzy=true
    (AzureDiagnostics | where ResourceType == 'VIRTUALNETWORKGATEWAYS' and Category == 'TunnelDiagnosticLog' and TimeGenerated >= t
     | project TimeGenerated, bytesIn = todouble(dataTransferred_In_d), bytesOut = todouble(dataTransferred_Out_d)),
    (VNGTunnelDiagnosticLog | where TimeGenerated >= t
     | project TimeGenerated, bytesIn = todouble(BytesTransferredIn), bytesOut = todouble(BytesTransferredOut))
| summarize bytesIn = sum(bytesIn), bytesOut = sum(bytesOut) by bin(TimeGenerated, 1h)
| order by TimeGenerated asc";

                foreach (var wsId in workspaceIds)
                {
                    try
                    {
                        using var tunnelDoc = await monitorClient.QueryWorkspaceAsync(wsId, tunnelKql, cancellationToken);
                        if (TryGetFirstMonitorTable(tunnelDoc.RootElement, out var tCols, out var tRows))
                        {
                            var timeIdx = FindColumnIndex(tCols, "TimeGenerated");
                            var inIdx = FindColumnIndex(tCols, "bytesIn");
                            var outIdx = FindColumnIndex(tCols, "bytesOut");
                            foreach (var row in tRows.EnumerateArray())
                            {
                                var cells = row.EnumerateArray().ToArray();
                                var hour = timeIdx >= 0 && cells.Length > timeIdx ? cells[timeIdx].GetString() ?? "" : "";
                                var bytesIn = inIdx >= 0 && cells.Length > inIdx && cells[inIdx].ValueKind == JsonValueKind.Number ? (long)cells[inIdx].GetDouble() : 0L;
                                var bytesOut = outIdx >= 0 && cells.Length > outIdx && cells[outIdx].ValueKind == JsonValueKind.Number ? (long)cells[outIdx].GetDouble() : 0L;
                                if (!string.IsNullOrWhiteSpace(hour))
                                    tunnelTrend.Add(new VpnGatewayTunnelPointDto(hour, bytesIn, bytesOut));
                            }
                            if (tunnelTrend.Count > 0) hasLaData = true;
                        }
                    }
                    catch (Exception ex) { logger.LogWarning(ex, "VPN Gateway Log Analytics query failed for workspace {WorkspaceId}.", wsId); }
                }
            }

            // ── Insights ──────────────────────────────────────────────────────
            int healthy = gateways.Count(g => g.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase));
            int degraded = gateways.Count - healthy;
            int connected = connections.Count(c => c.ConnectionStatus.Equals("Connected", StringComparison.OrdinalIgnoreCase));

            var insights = new List<VpnGatewayInsightDto>();
            foreach (var gw in gateways)
            {
                if (!gw.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase))
                    insights.Add(new VpnGatewayInsightDto("Health", $"{gw.Name}: provisioning state is '{gw.ProvisioningState}'.", "High"));

                if (gw.ConnectionCount == 0)
                    insights.Add(new VpnGatewayInsightDto("Connectivity", $"{gw.Name}: no VPN connections found — gateway may be idle.", "Medium"));

                if (!gw.BgpEnabled && gw.GatewayType.Equals("Vpn", StringComparison.OrdinalIgnoreCase))
                    insights.Add(new VpnGatewayInsightDto("Routing", $"{gw.Name}: BGP is not enabled — consider enabling for dynamic routing.", "Low"));

                if (!gw.ActiveActiveEnabled && gw.GatewayType.Equals("Vpn", StringComparison.OrdinalIgnoreCase))
                    insights.Add(new VpnGatewayInsightDto("Resilience", $"{gw.Name}: active-active mode is disabled — single point of failure for VPN connectivity.", "Medium"));
            }

            foreach (var conn in connections)
            {
                if (!conn.ConnectionStatus.Equals("Connected", StringComparison.OrdinalIgnoreCase)
                    && !conn.ConnectionStatus.Equals("Unknown", StringComparison.OrdinalIgnoreCase)
                    && !string.IsNullOrEmpty(conn.ConnectionStatus))
                    insights.Add(new VpnGatewayInsightDto("Connectivity", $"Connection '{conn.Name}' is in state '{conn.ConnectionStatus}'.", "High"));
            }

            if (!hasLaData && gateways.Count > 0)
                insights.Add(new VpnGatewayInsightDto("Diagnostics", "No Log Analytics data found. Configure diagnostic settings on VPN Gateways for tunnel traffic insights.", "Medium"));

            return new VpnGatewayDashboardDto(
                TenantId:            tenantId,
                GeneratedAt:         DateTimeOffset.UtcNow,
                TotalGateways:       gateways.Count,
                HealthyCount:        healthy,
                DegradedCount:       degraded,
                TotalConnections:    connections.Count,
                ConnectedTunnels:    connected,
                HasLogAnalyticsData: hasLaData,
                Gateways:            gateways,
                Connections:         connections,
                TunnelTrend:         tunnelTrend,
                Insights:            insights);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GetVpnGatewayDashboardAsync failed for tenant {TenantId}.", tenantId);
            return new VpnGatewayDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, false, [], [], [], []);
        }
    }
}
