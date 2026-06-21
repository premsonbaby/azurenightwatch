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
    // ── Azure Firewall ────────────────────────────────────────────────────────
    public async Task<AzureFirewallDashboardDto> GetAzureFirewallDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new AzureFirewallDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, false, false, 0, 0, 0, [], [], [], [], [], [], []);

        var firewalls = new List<AzureFirewallInstanceDto>();
        var policies = new List<AzureFirewallPolicyDto>();
        var trafficTrend = new List<AzureFirewallTrafficPointDto>();
        var topBlocked = new List<AzureFirewallTopBlockedDto>();
        var threatHits = new List<AzureFirewallThreatHitDto>();

        // ── ARG: Azure Firewall instances ─────────────────────────────────────
        const string firewallQuery = @"resources
| where type =~ 'microsoft.network/azurefirewalls'
| extend skuTier = tostring(properties.sku.tier)
| extend threatIntelMode = tostring(properties.threatIntelMode)
| extend provisioningState = tostring(properties.provisioningState)
| extend policyId = tostring(properties.firewallPolicy.id)
| extend virtualHubId = tostring(properties.virtualHub.id)
| extend publicIpCount = array_length(properties.ipConfigurations)
| project id, name, subscriptionId, location, skuTier, threatIntelMode, provisioningState, policyId, virtualHubId, publicIpCount
| order by name asc";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(firewallQuery, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var policyId = GetStringProperty(item, "policyId") ?? "";
                    var virtualHubId = GetStringProperty(item, "virtualHubId") ?? "";
                    var ipCount = item.TryGetProperty("publicIpCount", out var ipProp) && ipProp.ValueKind == JsonValueKind.Number ? ipProp.GetInt32() : 0;

                    firewalls.Add(new AzureFirewallInstanceDto(
                        GetStringProperty(item, "id") ?? "",
                        GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                        GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "skuTier") ?? "Standard",
                        GetStringProperty(item, "threatIntelMode") ?? "Alert",
                        GetStringProperty(item, "provisioningState") ?? "",
                        !string.IsNullOrWhiteSpace(policyId) ? GetResourceNameFromId(policyId) : null,
                        !string.IsNullOrWhiteSpace(virtualHubId),
                        ipCount));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Azure Firewall ARG query failed for tenant {TenantId}.", tenantId); }

        // ── ARG: Firewall Policies ────────────────────────────────────────────
        const string policyQuery = @"resources
| where type =~ 'microsoft.network/firewallpolicies'
| extend threatIntelMode = tostring(properties.threatIntelMode)
| extend dnsProxy = tostring(properties.dnsSettings.enableProxy)
| extend hasTls = isnotnull(properties.transportSecurity) and isnotnull(properties.transportSecurity.certificateAuthority)
| project id, name, subscriptionId, location, threatIntelMode, dnsProxy, hasTls
| order by name asc";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(policyQuery, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var policyName = GetStringProperty(item, "name") ?? "";
                    var linked = firewalls.Count(f => f.PolicyName != null &&
                        f.PolicyName.Equals(policyName, StringComparison.OrdinalIgnoreCase));
                    var hasTls = item.TryGetProperty("hasTls", out var tlsProp) && tlsProp.ValueKind == JsonValueKind.True;
                    var dnsProxy = (GetStringProperty(item, "dnsProxy") ?? "").Equals("true", StringComparison.OrdinalIgnoreCase);

                    policies.Add(new AzureFirewallPolicyDto(
                        GetStringProperty(item, "id") ?? "",
                        policyName,
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"),
                        GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "threatIntelMode") ?? "Alert",
                        dnsProxy,
                        hasTls,
                        linked));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Azure Firewall Policy ARG query failed for tenant {TenantId}.", tenantId); }

        // ── ARG: Overly permissive network rules (Any/Any) ───────────────────
        var permissiveRules = new List<AzureFirewallPermissiveRuleDto>();
        const string ruleQuery = @"resources
| where type =~ 'microsoft.network/firewallpolicies/rulecollectiongroups'
| mv-expand ruleCollection = properties.ruleCollections
| where ruleCollection.ruleCollectionType =~ 'FirewallPolicyFilterRuleCollection'
| mv-expand rule = ruleCollection.rules
| where rule.ruleType =~ 'NetworkRule' or rule.ruleType =~ 'ApplicationRule'
| extend sourceAddresses = tostring(rule.sourceAddresses)
| extend destinationAddresses = tostring(rule.destinationAddresses)
| extend destinationPorts = tostring(rule.destinationPorts)
| extend action = tostring(ruleCollection.action.type)
| where action =~ 'Allow'
| where sourceAddresses contains '*' or destinationAddresses contains '*' or destinationPorts contains '*'
| project policyId = tostring(split(id, '/ruleCollectionGroups/')[0]), ruleCollectionName = tostring(ruleCollection.name), ruleName = tostring(rule.name), sourceAddresses, destinationAddresses, destinationPorts, action
| order by policyId asc, ruleCollectionName asc";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(ruleQuery, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var policyId = GetStringProperty(item, "policyId") ?? "";
                    var policyName = policies.FirstOrDefault(p => p.ResourceId.Equals(policyId, StringComparison.OrdinalIgnoreCase))?.Name
                        ?? GetResourceNameFromId(policyId);
                    permissiveRules.Add(new AzureFirewallPermissiveRuleDto(
                        policyName,
                        GetStringProperty(item, "ruleCollectionName") ?? "",
                        GetStringProperty(item, "ruleName") ?? "",
                        GetStringProperty(item, "sourceAddresses") ?? "",
                        GetStringProperty(item, "destinationAddresses") ?? "",
                        GetStringProperty(item, "destinationPorts") ?? ""));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Azure Firewall permissive rule ARG query failed for tenant {TenantId}.", tenantId); }

        // ── Log Analytics ─────────────────────────────────────────────────────
        var workspaceIds = operationsScopeService.GetCurrent().LogAnalyticsWorkspaceIds;
        var hasLogAnalyticsData = false;

        if (workspaceIds.Count > 0)
        {
            const string trafficKql = @"let t = ago(24h);
union isfuzzy=true
(AzureDiagnostics | where ResourceType == 'AZUREFIREWALLS' and TimeGenerated >= t | where Category in ('AzureFirewallNetworkRule','AzureFirewallApplicationRule') | extend IsAllow = msg_s contains 'Allow' | project TimeGenerated, IsAllow),
(AZFWNetworkRule | where TimeGenerated >= t | extend IsAllow = Action =~ 'Allow' | project TimeGenerated, IsAllow),
(AZFWApplicationRule | where TimeGenerated >= t | extend IsAllow = Action =~ 'Allow' | project TimeGenerated, IsAllow)
| summarize AllowedCount = countif(IsAllow == true), DeniedCount = countif(IsAllow == false) by Hour = bin(TimeGenerated, 1h)
| order by Hour asc";

            const string topBlockedKql = @"let t = ago(24h);
union isfuzzy=true
(AzureDiagnostics | where ResourceType == 'AZUREFIREWALLS' and TimeGenerated >= t | where Category in ('AzureFirewallNetworkRule','AzureFirewallApplicationRule') | where msg_s contains 'Deny' | parse kind=regex msg_s with * @'to (?P<Dest>[^ :]+)' * | project Dest),
(AZFWNetworkRule | where TimeGenerated >= t | where Action =~ 'Deny' | project Dest = DestinationIp),
(AZFWApplicationRule | where TimeGenerated >= t | where Action =~ 'Deny' | project Dest = TargetFqdn)
| where isnotempty(Dest)
| summarize HitCount = count() by Dest
| order by HitCount desc
| take 10";

            const string threatKql = @"let t = ago(24h);
union isfuzzy=true
(AzureDiagnostics | where ResourceType == 'AZUREFIREWALLS' and TimeGenerated >= t | where Category == 'AzureFirewallThreatIntelLog' | project ThreatName = tostring(reason_s), SourceIp = tostring(srcip_s), DestIp = tostring(dstip_s), Action = tostring(action_s)),
(AZFWThreatIntel | where TimeGenerated >= t | project ThreatName = Reason, SourceIp, DestIp = DestinationIp, Action)
| where isnotempty(ThreatName)
| summarize Count = count() by ThreatName, SourceIp, DestIp, Action
| order by Count desc
| take 20";

            foreach (var wsId in workspaceIds)
            {
                try
                {
                    var trafficTask = monitorClient.QueryWorkspaceAsync(wsId, trafficKql, cancellationToken);
                    var blockedTask = monitorClient.QueryWorkspaceAsync(wsId, topBlockedKql, cancellationToken);
                    var threatTask = monitorClient.QueryWorkspaceAsync(wsId, threatKql, cancellationToken);
                    await Task.WhenAll(trafficTask, blockedTask, threatTask);

                    // Parse traffic trend
                    using var trafficDoc = await trafficTask;
                    if (TryGetFirstMonitorTable(trafficDoc.RootElement, out var tCols, out var tRows))
                    {
                        var hourIdx = FindColumnIndex(tCols, "Hour");
                        var allowIdx = FindColumnIndex(tCols, "AllowedCount");
                        var denyIdx = FindColumnIndex(tCols, "DeniedCount");
                        if (hourIdx >= 0)
                        {
                            foreach (var row in tRows.EnumerateArray())
                            {
                                var cells = row.EnumerateArray().ToArray();
                                if (cells.Length > Math.Max(allowIdx, denyIdx))
                                {
                                    var hourStr = hourIdx >= 0 && cells.Length > hourIdx ? cells[hourIdx].GetString() ?? "" : "";
                                    var allowed = allowIdx >= 0 && cells.Length > allowIdx && cells[allowIdx].ValueKind == JsonValueKind.Number ? cells[allowIdx].GetInt64() : 0L;
                                    var denied = denyIdx >= 0 && cells.Length > denyIdx && cells[denyIdx].ValueKind == JsonValueKind.Number ? cells[denyIdx].GetInt64() : 0L;
                                    if (!string.IsNullOrWhiteSpace(hourStr))
                                    {
                                        var existing = trafficTrend.FirstOrDefault(t => t.Hour == hourStr);
                                        if (existing != null)
                                            trafficTrend[trafficTrend.IndexOf(existing)] = new AzureFirewallTrafficPointDto(hourStr, existing.AllowedCount + allowed, existing.DeniedCount + denied);
                                        else
                                            trafficTrend.Add(new AzureFirewallTrafficPointDto(hourStr, allowed, denied));
                                    }
                                }
                            }
                            hasLogAnalyticsData = true;
                        }
                    }

                    // Parse top blocked
                    using var blockedDoc = await blockedTask;
                    if (TryGetFirstMonitorTable(blockedDoc.RootElement, out var bCols, out var bRows))
                    {
                        var destIdx = FindColumnIndex(bCols, "Dest");
                        var hitIdx = FindColumnIndex(bCols, "HitCount");
                        foreach (var row in bRows.EnumerateArray())
                        {
                            var cells = row.EnumerateArray().ToArray();
                            var dest = destIdx >= 0 && cells.Length > destIdx ? cells[destIdx].GetString() ?? "" : "";
                            var hits = hitIdx >= 0 && cells.Length > hitIdx && cells[hitIdx].ValueKind == JsonValueKind.Number ? cells[hitIdx].GetInt64() : 0L;
                            if (!string.IsNullOrWhiteSpace(dest))
                                topBlocked.Add(new AzureFirewallTopBlockedDto(dest, hits));
                        }
                        hasLogAnalyticsData = true;
                    }

                    // Parse threat hits
                    using var threatDoc = await threatTask;
                    if (TryGetFirstMonitorTable(threatDoc.RootElement, out var thrCols, out var thrRows))
                    {
                        var nameIdx = FindColumnIndex(thrCols, "ThreatName");
                        var srcIdx = FindColumnIndex(thrCols, "SourceIp");
                        var dstIdx = FindColumnIndex(thrCols, "DestIp");
                        var actIdx = FindColumnIndex(thrCols, "Action");
                        var cntIdx = FindColumnIndex(thrCols, "Count");
                        foreach (var row in thrRows.EnumerateArray())
                        {
                            var cells = row.EnumerateArray().ToArray();
                            var name = nameIdx >= 0 && cells.Length > nameIdx ? cells[nameIdx].GetString() ?? "" : "";
                            var src = srcIdx >= 0 && cells.Length > srcIdx ? cells[srcIdx].GetString() ?? "" : "";
                            var dst = dstIdx >= 0 && cells.Length > dstIdx ? cells[dstIdx].GetString() ?? "" : "";
                            var act = actIdx >= 0 && cells.Length > actIdx ? cells[actIdx].GetString() ?? "" : "";
                            var cnt = cntIdx >= 0 && cells.Length > cntIdx && cells[cntIdx].ValueKind == JsonValueKind.Number ? cells[cntIdx].GetInt64() : 0L;
                            if (!string.IsNullOrWhiteSpace(name))
                                threatHits.Add(new AzureFirewallThreatHitDto(name, src, dst, act, cnt));
                        }
                        hasLogAnalyticsData = true;
                    }
                }
                catch (Exception ex) { logger.LogWarning(ex, "Azure Firewall Log Analytics query failed for workspace {WorkspaceId}.", wsId); }
            }

            // Consolidate top blocked across workspaces
            topBlocked = topBlocked
                .GroupBy(b => b.Destination, StringComparer.OrdinalIgnoreCase)
                .Select(g => new AzureFirewallTopBlockedDto(g.Key, g.Sum(b => b.HitCount)))
                .OrderByDescending(b => b.HitCount)
                .Take(10)
                .ToList();
        }

        // ── Insights ──────────────────────────────────────────────────────────
        var insights = new List<AzureFirewallInsightDto>();
        var totalAllowed = trafficTrend.Sum(t => t.AllowedCount);
        var totalBlocked = trafficTrend.Sum(t => t.DeniedCount);
        var totalThreatHits = (int)Math.Min(threatHits.Sum(t => t.Count), int.MaxValue);

        if (firewalls.Any(f => f.ThreatIntelMode.Equals("Off", StringComparison.OrdinalIgnoreCase)))
            insights.Add(new AzureFirewallInsightDto("Security",
                "One or more firewalls have Threat Intelligence mode set to 'Off'. Set to 'Alert' or 'Alert and Deny' to detect and block known malicious IP addresses and domains.",
                "High"));

        if (firewalls.Any(f => f.PolicyName == null))
            insights.Add(new AzureFirewallInsightDto("Governance",
                "Classic rule-based firewall(s) detected with no associated Firewall Policy. Migrate to Azure Firewall Policy to enable IDPS, TLS inspection, and centralized multi-firewall management.",
                "Medium"));

        if (!hasLogAnalyticsData && firewalls.Count > 0)
            insights.Add(new AzureFirewallInsightDto("Observability",
                "No firewall diagnostic logs found in the configured Log Analytics workspace(s). Enable 'AzureFirewallNetworkRule', 'AzureFirewallApplicationRule', and 'AzureFirewallThreatIntelLog' diagnostic settings to unlock traffic analysis.",
                "High"));

        if (totalAllowed + totalBlocked > 0 && (double)totalBlocked / (totalAllowed + totalBlocked) > 0.25)
            insights.Add(new AzureFirewallInsightDto("Traffic",
                $"High deny rate: {totalBlocked:N0} connections blocked ({(double)totalBlocked / (totalAllowed + totalBlocked) * 100:F0}% of all traffic in the last 24 h). Review top-blocked destinations — this could indicate misconfigured rules or active lateral movement.",
                "Medium"));

        if (totalThreatHits > 0)
            insights.Add(new AzureFirewallInsightDto("Threat Intelligence",
                $"{totalThreatHits:N0} threat intelligence hit(s) recorded in the last 24 hours. Review source IPs and consider adding explicit deny rules or enabling 'Alert and Deny' mode to automatically block future attempts.",
                "High"));

        if (permissiveRules.Count > 0)
            insights.Add(new AzureFirewallInsightDto("Rule Quality",
                $"{permissiveRules.Count} overly permissive Allow rule(s) detected with wildcard source, destination, or port ranges. Review and restrict to the least-privilege addresses and ports required by each workload.",
                "High"));

        if (firewalls.Any(f => !f.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase)))
            insights.Add(new AzureFirewallInsightDto("Availability",
                "One or more Azure Firewalls are not in a 'Succeeded' provisioning state. Check the Azure portal for ongoing operations or failures.",
                "High"));

        var healthyCount = firewalls.Count(f => f.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase));

        return new AzureFirewallDashboardDto(
            tenantId, DateTimeOffset.UtcNow,
            TotalFirewalls: firewalls.Count,
            HealthyCount: healthyCount,
            DegradedCount: firewalls.Count - healthyCount,
            HasPolicies: policies.Count > 0,
            HasLogAnalyticsData: hasLogAnalyticsData,
            TotalAllowedLast24h: totalAllowed,
            TotalBlockedLast24h: totalBlocked,
            ThreatIntelHits: totalThreatHits,
            Firewalls: firewalls.ToArray(),
            Policies: policies.ToArray(),
            TrafficTrend: trafficTrend.OrderBy(t => t.Hour).ToArray(),
            TopBlockedDestinations: topBlocked.ToArray(),
            ThreatHits: threatHits.ToArray(),
            PermissiveRules: permissiveRules.ToArray(),
            Insights: insights.ToArray());
    }
}
