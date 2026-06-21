using System.Text.Json;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Contracts;

namespace NightWatch.Infrastructure.Services;

public sealed partial class NightWatchInsightsService
{
    public async Task<AppGatewayDashboardDto> GetAppGatewayDashboardAsync(
        string tenantId, CancellationToken cancellationToken)
    {
        try
        {
            var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
            var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId)
                .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

            if (subscriptionIds.Length == 0)
                return new AppGatewayDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, 0, false, [], [], [], [], [], []);

            // ── ARG: Application Gateways ─────────────────────────────────────
            const string argQuery = @"resources
| where type == 'microsoft.network/applicationgateways'
| extend
    skuTier          = tostring(properties.sku.tier),
    skuCapacity      = toint(properties.sku.capacity),
    provState        = tostring(properties.provisioningState),
    wafCfg           = properties.webApplicationFirewallConfiguration,
    autoScaleCfg     = properties.autoscaleConfiguration,
    frontendIps      = properties.frontendIPConfigurations,
    backendPools     = properties.backendAddressPools,
    listeners        = properties.httpListeners,
    routingRules     = properties.requestRoutingRules,
    sslPol           = properties.sslPolicy,
    http2            = tobool(properties.enableHttp2)
| extend
    wafEnabled       = tobool(wafCfg.enabled),
    wafMode          = tostring(wafCfg.firewallMode),
    wafRuleSetType   = tostring(wafCfg.ruleSetType),
    wafRuleSetVer    = tostring(wafCfg.ruleSetVersion),
    sslPolicyName    = tostring(sslPol.policyName),
    backendPoolCount = array_length(backendPools),
    listenerCount    = array_length(listeners),
    routingRuleCount = array_length(routingRules),
    autoscaleEnabled = isnotnull(autoScaleCfg)
| project
    id, name, subscriptionId, location,
    skuTier, skuCapacity, provState, wafEnabled, wafMode,
    wafRuleSetType, wafRuleSetVer, sslPolicyName,
    backendPoolCount, listenerCount, routingRuleCount,
    http2, autoscaleEnabled, frontendIps
| order by name asc";

            var gateways = new List<AppGatewayInstanceDto>();

            try
            {
                using var argResult = await azureResourceGraphClient.QueryResourcesAsync(argQuery, subscriptionIds, null, cancellationToken);
                if (argResult.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        try
                        {
                            var subId = GetStringProperty(item, "subscriptionId") ?? "";

                            int pubIpCount = 0;
                            if (item.TryGetProperty("frontendIps", out var fips) && fips.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var fip in fips.EnumerateArray())
                                {
                                    if (fip.TryGetProperty("properties", out var fp) &&
                                        fp.TryGetProperty("publicIPAddress", out var pip) &&
                                        pip.ValueKind != JsonValueKind.Null)
                                        pubIpCount++;
                                }
                            }

                            gateways.Add(new AppGatewayInstanceDto(
                                ResourceId:            GetStringProperty(item, "id") ?? "",
                                Name:                  GetStringProperty(item, "name") ?? "",
                                SubscriptionName:      subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                                Location:              GetStringProperty(item, "location") ?? "",
                                SkuTier:               GetStringProperty(item, "skuTier") ?? "",
                                SkuCapacity:           item.TryGetProperty("skuCapacity", out var cap) && cap.ValueKind == JsonValueKind.Number ? cap.GetInt32() : 0,
                                ProvisioningState:     GetStringProperty(item, "provState") ?? "",
                                WafEnabled:            item.TryGetProperty("wafEnabled", out var waf) && waf.ValueKind == JsonValueKind.True,
                                WafMode:               GetStringProperty(item, "wafMode") ?? "",
                                WafRuleSetType:        GetStringProperty(item, "wafRuleSetType") ?? "",
                                WafRuleSetVersion:     GetStringProperty(item, "wafRuleSetVer") ?? "",
                                SslPolicyName:         GetStringProperty(item, "sslPolicyName") ?? "",
                                BackendPoolCount:      item.TryGetProperty("backendPoolCount", out var bpc) && bpc.ValueKind == JsonValueKind.Number ? bpc.GetInt32() : 0,
                                ListenerCount:         item.TryGetProperty("listenerCount", out var lc) && lc.ValueKind == JsonValueKind.Number ? lc.GetInt32() : 0,
                                RoutingRuleCount:      item.TryGetProperty("routingRuleCount", out var rrc) && rrc.ValueKind == JsonValueKind.Number ? rrc.GetInt32() : 0,
                                Http2Enabled:          item.TryGetProperty("http2", out var h2) && h2.ValueKind == JsonValueKind.True,
                                AutoscaleEnabled:      item.TryGetProperty("autoscaleEnabled", out var ase) && ase.ValueKind == JsonValueKind.True,
                                FrontendPublicIpCount: pubIpCount));
                        }
                        catch { /* skip malformed row */ }
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "AppGateway ARG query failed for tenant {TenantId}.", tenantId); }

            // ── ARG: HTTP Listeners (name, protocol, hostname) ────────────────
            const string listenerQuery = @"resources
| where type == 'microsoft.network/applicationgateways'
| mv-expand listener = properties.httpListeners
| extend
    listenerName = tostring(listener.name),
    protocol     = tostring(listener.properties.protocol),
    hostName     = tostring(listener.properties.hostName),
    firstHost    = tostring(listener.properties.hostNames[0])
| extend
    hostname = iff(isnotempty(hostName), hostName, iff(isnotempty(firstHost), firstHost, '*'))
| project id, listenerName, protocol, hostname
| order by id asc, listenerName asc";

            var listeners = new List<AppGatewayListenerDto>();

            try
            {
                using var listenerResult = await azureResourceGraphClient.QueryResourcesAsync(listenerQuery, subscriptionIds, null, cancellationToken);
                if (listenerResult.RootElement.TryGetProperty("data", out var lData) && lData.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in lData.EnumerateArray())
                    {
                        try
                        {
                            var gwId       = GetStringProperty(item, "id") ?? "";
                            var lName      = GetStringProperty(item, "listenerName") ?? "";
                            var protocol   = GetStringProperty(item, "protocol") ?? "HTTP";
                            var hostname   = GetStringProperty(item, "hostname") ?? "*";
                            if (!string.IsNullOrWhiteSpace(gwId) && !string.IsNullOrWhiteSpace(lName))
                                listeners.Add(new AppGatewayListenerDto(gwId, lName, protocol, hostname));
                        }
                        catch { /* skip malformed row */ }
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "AppGateway listener ARG query failed for tenant {TenantId}.", tenantId); }

            // ── Log Analytics: traffic + WAF ──────────────────────────────────
            var trafficTrend = new List<AppGatewayTrafficPointDto>();
            var topUrls = new List<AppGatewayTopUrlDto>();
            var topWafBlocks = new List<AppGatewayWafBlockDto>();
            bool hasLaData = false;

            var workspaceIds = operationsScopeService.GetCurrent().LogAnalyticsWorkspaceIds;

            if (workspaceIds.Count > 0)
            {
                const string trafficKql = @"let t = ago(24h);
union isfuzzy=true
    (AzureDiagnostics | where ResourceType == 'APPLICATIONGATEWAYS' and Category == 'ApplicationGatewayAccessLog' and TimeGenerated >= t
     | project TimeGenerated, requestUri_s, httpStatus_d, timeTaken_d),
    (AGWAccessLogs | where TimeGenerated >= t | project TimeGenerated, requestUri_s = RequestUri, httpStatus_d = toint(HttpStatus), timeTaken_d = todouble(TimeTaken))
| summarize requestCount = count() by bin(TimeGenerated, 1h)
| order by TimeGenerated asc";

                const string wafKql = @"let t = ago(24h);
union isfuzzy=true
    (AzureDiagnostics | where ResourceType == 'APPLICATIONGATEWAYS' and Category == 'ApplicationGatewayFirewallLog' and TimeGenerated >= t
     | where action_s == 'Blocked' | project TimeGenerated),
    (AGWFirewallLogs | where TimeGenerated >= t | where Action == 'Blocked' | project TimeGenerated)
| summarize blockedCount = count() by bin(TimeGenerated, 1h)
| order by TimeGenerated asc";

                const string urlKql = @"let t = ago(24h);
union isfuzzy=true
    (AzureDiagnostics | where ResourceType == 'APPLICATIONGATEWAYS' and Category == 'ApplicationGatewayAccessLog' and TimeGenerated >= t
     | project requestUri_s),
    (AGWAccessLogs | where TimeGenerated >= t | project requestUri_s = RequestUri)
| where isnotempty(requestUri_s)
| summarize requestCount = count() by requestUri_s
| top 10 by requestCount desc";

                const string wafRuleKql = @"let t = ago(24h);
union isfuzzy=true
    (AzureDiagnostics | where ResourceType == 'APPLICATIONGATEWAYS' and Category == 'ApplicationGatewayFirewallLog' and TimeGenerated >= t
     | where action_s == 'Blocked' | project ruleId_s, Message = message_s),
    (AGWFirewallLogs | where TimeGenerated >= t | where Action == 'Blocked' | project ruleId_s = RuleId, Message)
| where TimeGenerated > ago(24h)
| summarize hitCount = count() by ruleId_s, Message
| top 10 by hitCount desc";

                foreach (var wsId in workspaceIds)
                {
                    try
                    {
                        var trafficTask = monitorClient.QueryWorkspaceAsync(wsId, trafficKql, cancellationToken);
                        var wafTask = monitorClient.QueryWorkspaceAsync(wsId, wafKql, cancellationToken);
                        var urlTask = monitorClient.QueryWorkspaceAsync(wsId, urlKql, cancellationToken);
                        var wafRuleTask = monitorClient.QueryWorkspaceAsync(wsId, wafRuleKql, cancellationToken);
                        await Task.WhenAll(trafficTask, wafTask, urlTask, wafRuleTask);

                        using var trafficDoc = await trafficTask;
                        if (TryGetFirstMonitorTable(trafficDoc.RootElement, out var tCols, out var tRows))
                        {
                            var timeIdx = FindColumnIndex(tCols, "TimeGenerated");
                            var cntIdx = FindColumnIndex(tCols, "requestCount");
                            foreach (var row in tRows.EnumerateArray())
                            {
                                var cells = row.EnumerateArray().ToArray();
                                var hour = timeIdx >= 0 && cells.Length > timeIdx ? cells[timeIdx].GetString() ?? "" : "";
                                var cnt = cntIdx >= 0 && cells.Length > cntIdx && cells[cntIdx].ValueKind == JsonValueKind.Number ? cells[cntIdx].GetInt64() : 0L;
                                if (!string.IsNullOrWhiteSpace(hour))
                                    trafficTrend.Add(new AppGatewayTrafficPointDto(hour, cnt, 0));
                            }
                            if (trafficTrend.Count > 0) hasLaData = true;
                        }

                        using var wafDoc = await wafTask;
                        if (TryGetFirstMonitorTable(wafDoc.RootElement, out var wCols, out var wRows))
                        {
                            var timeIdx = FindColumnIndex(wCols, "TimeGenerated");
                            var blkIdx = FindColumnIndex(wCols, "blockedCount");
                            var blockMap = new Dictionary<string, long>();
                            foreach (var row in wRows.EnumerateArray())
                            {
                                var cells = row.EnumerateArray().ToArray();
                                var hour = timeIdx >= 0 && cells.Length > timeIdx ? cells[timeIdx].GetString() ?? "" : "";
                                var cnt = blkIdx >= 0 && cells.Length > blkIdx && cells[blkIdx].ValueKind == JsonValueKind.Number ? cells[blkIdx].GetInt64() : 0L;
                                if (!string.IsNullOrWhiteSpace(hour))
                                {
                                    var key = hour.Length >= 16 ? hour[..16] + ":00" : hour;
                                    blockMap[key] = cnt;
                                }
                            }
                            for (int i = 0; i < trafficTrend.Count; i++)
                            {
                                var h = trafficTrend[i].Hour;
                                var key = h.Length >= 16 ? h[..16] + ":00" : h;
                                if (blockMap.TryGetValue(key, out var bc))
                                    trafficTrend[i] = trafficTrend[i] with { BlockedCount = bc };
                            }
                            if (blockMap.Count > 0) hasLaData = true;
                        }

                        using var urlDoc = await urlTask;
                        if (TryGetFirstMonitorTable(urlDoc.RootElement, out var uCols, out var uRows))
                        {
                            var uIdx = FindColumnIndex(uCols, "requestUri_s");
                            var ucIdx = FindColumnIndex(uCols, "requestCount");
                            foreach (var row in uRows.EnumerateArray())
                            {
                                var cells = row.EnumerateArray().ToArray();
                                var url = uIdx >= 0 && cells.Length > uIdx ? cells[uIdx].GetString() ?? "" : "";
                                var cnt = ucIdx >= 0 && cells.Length > ucIdx && cells[ucIdx].ValueKind == JsonValueKind.Number ? cells[ucIdx].GetInt64() : 0L;
                                if (!string.IsNullOrWhiteSpace(url))
                                    topUrls.Add(new AppGatewayTopUrlDto(url, cnt));
                            }
                            if (topUrls.Count > 0) hasLaData = true;
                        }

                        using var wafRuleDoc = await wafRuleTask;
                        if (TryGetFirstMonitorTable(wafRuleDoc.RootElement, out var rCols, out var rRows))
                        {
                            var rIdx = FindColumnIndex(rCols, "ruleId_s");
                            var mIdx = FindColumnIndex(rCols, "Message");
                            var hcIdx = FindColumnIndex(rCols, "hitCount");
                            foreach (var row in rRows.EnumerateArray())
                            {
                                var cells = row.EnumerateArray().ToArray();
                                var ruleId = rIdx >= 0 && cells.Length > rIdx ? cells[rIdx].GetString() ?? "" : "";
                                var msg = mIdx >= 0 && cells.Length > mIdx ? cells[mIdx].GetString() ?? "" : "";
                                var cnt = hcIdx >= 0 && cells.Length > hcIdx && cells[hcIdx].ValueKind == JsonValueKind.Number ? cells[hcIdx].GetInt64() : 0L;
                                topWafBlocks.Add(new AppGatewayWafBlockDto(ruleId, msg, cnt));
                            }
                            if (topWafBlocks.Count > 0) hasLaData = true;
                        }
                    }
                    catch (Exception ex) { logger.LogWarning(ex, "AppGateway Log Analytics query failed for workspace {WorkspaceId}.", wsId); }
                }

                topUrls = topUrls.GroupBy(u => u.Url, StringComparer.OrdinalIgnoreCase)
                    .Select(g => new AppGatewayTopUrlDto(g.Key, g.Sum(x => x.RequestCount)))
                    .OrderByDescending(u => u.RequestCount).Take(10).ToList();

                topWafBlocks = topWafBlocks.GroupBy(w => w.RuleId, StringComparer.OrdinalIgnoreCase)
                    .Select(g => new AppGatewayWafBlockDto(g.Key, g.First().Message, g.Sum(x => x.HitCount)))
                    .OrderByDescending(w => w.HitCount).Take(10).ToList();
            }

            // ── Insights ──────────────────────────────────────────────────────
            int healthy = gateways.Count(g => g.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase));
            int degraded = gateways.Count - healthy;
            int wafEnabled = gateways.Count(g => g.WafEnabled);
            int wafPrev = gateways.Count(g => g.WafEnabled && g.WafMode.Equals("Prevention", StringComparison.OrdinalIgnoreCase));
            long totalReq = trafficTrend.Sum(t => t.RequestCount);
            long totalBlk = trafficTrend.Sum(t => t.BlockedCount);

            var insights = new List<AppGatewayInsightDto>();
            foreach (var gw in gateways)
            {
                if (!gw.WafEnabled)
                    insights.Add(new AppGatewayInsightDto("WAF", $"{gw.Name}: WAF is not enabled — web application traffic is unprotected.", "High"));
                else if (!gw.WafMode.Equals("Prevention", StringComparison.OrdinalIgnoreCase))
                    insights.Add(new AppGatewayInsightDto("WAF", $"{gw.Name}: WAF is in Detection mode — threats are logged but not blocked.", "Medium"));

                if (!gw.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase))
                    insights.Add(new AppGatewayInsightDto("Health", $"{gw.Name}: provisioning state is '{gw.ProvisioningState}'.", "High"));

                if (string.IsNullOrEmpty(gw.SslPolicyName))
                    insights.Add(new AppGatewayInsightDto("SSL", $"{gw.Name}: no custom SSL policy configured — may use weak ciphers.", "Low"));
            }

            if (!hasLaData && gateways.Count > 0)
                insights.Add(new AppGatewayInsightDto("Diagnostics", "No Log Analytics data found. Configure diagnostic settings on Application Gateways for traffic and WAF insights.", "Medium"));

            if (totalBlk > 0 && totalReq > 0)
            {
                double blockRate = (double)totalBlk / totalReq * 100;
                if (blockRate > 10)
                    insights.Add(new AppGatewayInsightDto("WAF", $"WAF block rate is {blockRate:F1}% over the last 24 hours — review top blocked rules.", "High"));
            }

            return new AppGatewayDashboardDto(
                TenantId: tenantId,
                GeneratedAt: DateTimeOffset.UtcNow,
                TotalGateways: gateways.Count,
                HealthyCount: healthy,
                DegradedCount: degraded,
                WafEnabledCount: wafEnabled,
                WafPreventionCount: wafPrev,
                TotalRequests24h: totalReq,
                TotalBlocked24h: totalBlk,
                HasLogAnalyticsData: hasLaData,
                Gateways: gateways,
                Listeners: listeners,
                TrafficTrend: trafficTrend,
                TopUrls: topUrls,
                TopWafBlocks: topWafBlocks,
                Insights: insights);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GetAppGatewayDashboardAsync failed for tenant {TenantId}.", tenantId);
            return new AppGatewayDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, 0, false, [], [], [], [], [], []);
        }
    }
}
