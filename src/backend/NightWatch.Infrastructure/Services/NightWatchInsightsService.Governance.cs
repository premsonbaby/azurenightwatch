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
    public Task<GovernanceDashboardDto> GetGovernanceDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        return GetLiveGovernanceDashboardAsync(cancellationToken);
    }

    public async Task<TagHygieneDashboardDto> GetTagHygieneDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new TagHygieneDashboardDto(tenantId, DateTimeOffset.UtcNow, 0m, 0, 0, [], []);

        const string query = "resources | where isnotempty(id) | extend hasRequiredTags = (isnotempty(tags.Environment) and isnotempty(tags.Owner)) | summarize Total=count(), Untagged=countif(hasRequiredTags == false) by ResourceType=type, SubscriptionId=subscriptionId | order by Untagged desc";

        var typeStats = new Dictionary<string, (int Untagged, int Total)>(StringComparer.OrdinalIgnoreCase);
        var subStats = new Dictionary<string, (string Name, int Untagged, int Total)>(StringComparer.OrdinalIgnoreCase);

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var rt = GetStringProperty(item, "ResourceType") ?? GetStringProperty(item, "resourceType") ?? "unknown";
                    var subId = GetStringProperty(item, "SubscriptionId") ?? GetStringProperty(item, "subscriptionId") ?? "";
                    item.TryGetProperty("Total", out var totalEl);
                    item.TryGetProperty("Untagged", out var untaggedEl);
                    var total = totalEl.ValueKind == JsonValueKind.Number ? totalEl.GetInt32() : 0;
                    var untagged = untaggedEl.ValueKind == JsonValueKind.Number ? untaggedEl.GetInt32() : 0;

                    if (!typeStats.TryGetValue(rt, out var ts)) ts = (0, 0);
                    typeStats[rt] = (ts.Untagged + untagged, ts.Total + total);

                    if (!string.IsNullOrEmpty(subId))
                    {
                        if (!subStats.TryGetValue(subId, out var ss)) ss = (subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), 0, 0);
                        subStats[subId] = (ss.Name, ss.Untagged + untagged, ss.Total + total);
                    }
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Tag hygiene ARG query failed."); }

        var totalResources = typeStats.Values.Sum(v => v.Total);
        var totalUntagged = typeStats.Values.Sum(v => v.Untagged);
        var coverage = totalResources > 0 ? Math.Round((totalResources - totalUntagged) * 100m / totalResources, 1) : 100m;

        var topTypes = typeStats.OrderByDescending(kv => kv.Value.Untagged).Take(10)
            .Select(kv =>
            {
                var parts = kv.Key.Split('/');
                var shortType = parts.Length > 1 ? parts[^1] : kv.Key;
                return new TagHygieneResourceTypeDto(kv.Key, shortType, kv.Value.Untagged, kv.Value.Total);
            }).ToArray();

        var subBreakdown = subStats.Values.OrderByDescending(s => s.Untagged).Take(15)
            .Select(s =>
            {
                var pct = s.Total > 0 ? Math.Round((s.Total - s.Untagged) * 100m / s.Total, 1) : 100m;
                return new TagHygieneSubscriptionDto(s.Name, s.Name, s.Untagged, s.Total, pct);
            }).ToArray();

        return new TagHygieneDashboardDto(tenantId, DateTimeOffset.UtcNow, coverage, totalResources, totalUntagged, topTypes, subBreakdown);
    }

    // ── Orphaned Resources ───────────────────────────────────────────────────
    public async Task<OrphanedResourcesDashboardDto> GetOrphanedResourcesDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new OrphanedResourcesDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0m, 0, 0, 0, 0, []);

        const string query = "resources | where (type =~ 'microsoft.compute/disks' and properties.diskState =~ 'Unattached') or (type =~ 'microsoft.network/networkinterfaces' and isnull(properties.virtualMachine)) or (type =~ 'microsoft.network/publicipaddresses' and isnull(properties.ipConfiguration)) or (type =~ 'microsoft.compute/snapshots') | project id, name, type, subscriptionId";

        var items = new List<OrphanedResourceDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var rid = GetStringProperty(item, "id") ?? "";
                    var name = GetStringProperty(item, "name") ?? "unknown";
                    var rtype = GetStringProperty(item, "type") ?? "unknown";
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var subName = subNameMap.GetValueOrDefault(subId, "Unknown Subscription");

                    var (category, waste) = rtype.ToLowerInvariant() switch
                    {
                        var t when t.Contains("disks") => ("Unattached Disk", 12m),
                        var t when t.Contains("networkinterfaces") => ("Orphaned NIC", 4m),
                        var t when t.Contains("publicip") => ("Abandoned Public IP", 3m),
                        var t when t.Contains("snapshots") => ("Orphaned Snapshot", 2m),
                        _ => ("Other", 1m)
                    };
                    items.Add(new OrphanedResourceDto(rid, name, rtype, category, subName, waste));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Orphaned resources ARG query failed."); }

        var disks = items.Count(i => i.Category == "Unattached Disk");
        var nics = items.Count(i => i.Category == "Orphaned NIC");
        var pips = items.Count(i => i.Category == "Abandoned Public IP");
        var snaps = items.Count(i => i.Category == "Orphaned Snapshot");
        var totalWaste = items.Sum(i => i.EstimatedMonthlyWasteEur);

        return new OrphanedResourcesDashboardDto(tenantId, DateTimeOffset.UtcNow, items.Count, Math.Round(totalWaste, 2), disks, nics, pips, snaps, items.OrderByDescending(i => i.EstimatedMonthlyWasteEur).ToArray());
    }


    // ── Backup Health ────────────────────────────────────────────────────────
    public async Task<IamReviewDashboardDto> GetIamReviewDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new IamReviewDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, [], []);

        const string assignmentsQuery = "authorizationresources | where type =~ 'microsoft.authorization/roleassignments' | extend roleDefId=tostring(properties.roleDefinitionId), principalType=tostring(properties.principalType) | project subscriptionId, principalType, roleDefId";
        const string customRolesQuery = "authorizationresources | where type =~ 'microsoft.authorization/roledefinitions' | where properties.roleType =~ 'CustomRole' | summarize CustomRoleCount=count()";

        var subBreakdown = new Dictionary<string, (string Name, int Total, int Owners)>(StringComparer.OrdinalIgnoreCase);
        int totalAssignments = 0, ownerAssignments = 0, spAssignments = 0, userAssignments = 0, customRoleCount = 0;

        try
        {
            using var cr = await azureResourceGraphClient.QueryResourcesAsync(customRolesQuery, subscriptionIds, null, cancellationToken);
            if (cr.RootElement.TryGetProperty("data", out var crd) && crd.ValueKind == JsonValueKind.Array && crd.GetArrayLength() > 0)
            {
                var first = crd[0];
                if (first.TryGetProperty("CustomRoleCount", out var crc) && crc.ValueKind == JsonValueKind.Number) customRoleCount = crc.GetInt32();
            }

            using var ar = await azureResourceGraphClient.QueryResourcesAsync(assignmentsQuery, subscriptionIds, null, cancellationToken);
            if (ar.RootElement.TryGetProperty("data", out var ard) && ard.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in ard.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var principalType = GetStringProperty(item, "principalType") ?? "";
                    var roleDefId = GetStringProperty(item, "roleDefId") ?? "";
                    var isOwner = roleDefId.EndsWith("8e3af657-a8ff-443c-a75c-2fe8c4bcb635", StringComparison.OrdinalIgnoreCase);

                    totalAssignments++;
                    if (isOwner) ownerAssignments++;
                    if (principalType.Equals("ServicePrincipal", StringComparison.OrdinalIgnoreCase)) spAssignments++;
                    else if (principalType.Equals("User", StringComparison.OrdinalIgnoreCase)) userAssignments++;

                    if (!string.IsNullOrEmpty(subId))
                    {
                        if (!subBreakdown.TryGetValue(subId, out var sb)) sb = (subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), 0, 0);
                        subBreakdown[subId] = (sb.Name, sb.Total + 1, sb.Owners + (isOwner ? 1 : 0));
                    }
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "IAM review ARG query failed."); }

        var risks = new List<IamRiskItemDto>();
        if (ownerAssignments > 3) risks.Add(new IamRiskItemDto("Excessive Owner Assignments", "High", ownerAssignments, "Reduce Owner-role assignments and adopt least-privilege roles."));
        if (customRoleCount > 10) risks.Add(new IamRiskItemDto("High Custom Role Count", "Medium", customRoleCount, "Audit and consolidate custom RBAC roles to reduce complexity."));
        if (totalAssignments > 0 && spAssignments > totalAssignments / 2) risks.Add(new IamRiskItemDto("Service Principal Dominance", "Medium", spAssignments, "Review service principal permissions and remove unused identities."));

        var subList = subBreakdown.Values.OrderByDescending(s => s.Total).Take(15)
            .Select(s => new IamSubscriptionDto(s.Name, s.Total, s.Owners)).ToArray();

        return new IamReviewDashboardDto(tenantId, DateTimeOffset.UtcNow, totalAssignments, ownerAssignments, spAssignments, userAssignments, customRoleCount, risks, subList);
    }

    // ── Wastage Tracker ──────────────────────────────────────────────────────
    public async Task<AzPolicyLensDashboardDto> GetAzPolicyLensDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new AzPolicyLensDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0m, 0, 0, 0, [], [], [], []);

        // 1. ARG: policy assignments — display names, scopes, and effect parameter override
        const string assignmentsQuery = "policyresources | where type =~ 'microsoft.authorization/policyassignments' | extend effectParam=tostring(coalesce(properties.parameters.effect.value, properties.parameters.Effect.value, '')) | project id, subscriptionId, displayName=tostring(properties.displayName), scope=tostring(properties.scope), effectParam";

        // 2. ARG: custom policy definitions count
        const string definitionsQuery = "policyresources | where type =~ 'microsoft.authorization/policydefinitions' | where properties.policyType =~ 'Custom' | count";

        // 3. ARG: policy assignments effect breakdown via linked definitions
        const string effectQuery = "policyresources | where type =~ 'microsoft.authorization/policydefinitions' | where properties.policyType =~ 'Custom' | extend effect=tostring(properties.policyRule.then.effect) | where isnotempty(effect) | summarize count() by effect";

        // 4. ARG: policy exemptions count
        const string exemptionsQuery = "policyresources | where type =~ 'microsoft.authorization/policyexemptions' | count";

        var assignmentMap = new Dictionary<string, (string DisplayName, string Scope, string SubscriptionId, string Effect)>(StringComparer.OrdinalIgnoreCase);
        var customDefinitionCount = 0;
        var effectBreakdown = new List<PolicyEffectCountDto>();
        var totalExemptions = 0;

        // Parallel ARG queries
        var assignmentsTask = Task.Run(async () =>
        {
            try
            {
                using var result = await azureResourceGraphClient.QueryResourcesAsync(assignmentsQuery, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        var id = GetStringProperty(item, "id") ?? "";
                        var rawName = GetStringProperty(item, "displayName") ?? id.Split('/').LastOrDefault() ?? "Unknown";
                        // Strip Azure-injected subscription GUIDs e.g. "ASC Default (subscription: 88bf0283-...)"
                        var name = System.Text.RegularExpressions.Regex.Replace(
                            rawName, @"\s*\(subscription:\s*[0-9a-fA-F\-]{36}\)", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
                        if (string.IsNullOrWhiteSpace(name)) name = rawName;
                        var scope = GetStringProperty(item, "scope") ?? "";
                        var subId = GetStringProperty(item, "subscriptionId") ?? "";
                        var effect = GetStringProperty(item, "effectParam") ?? "";
                        if (!string.IsNullOrEmpty(id))
                            assignmentMap[id] = (name, scope, subId, effect);
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "AzPolicyLens assignments ARG query failed."); }
        }, cancellationToken);

        var definitionsTask = Task.Run(async () =>
        {
            try
            {
                using var result = await azureResourceGraphClient.QueryResourcesAsync(definitionsQuery, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        if (item.TryGetProperty("count_", out var countEl) && countEl.TryGetInt32(out var n))
                            customDefinitionCount = n;
                        else if (item.TryGetProperty("Count", out var countEl2) && countEl2.TryGetInt32(out var n2))
                            customDefinitionCount = n2;
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "AzPolicyLens definitions ARG query failed."); }
        }, cancellationToken);

        var effectTask = Task.Run(async () =>
        {
            try
            {
                using var result = await azureResourceGraphClient.QueryResourcesAsync(effectQuery, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        var effect = GetStringProperty(item, "effect") ?? "Unknown";
                        var count = 0;
                        if (item.TryGetProperty("count_", out var ce) && ce.TryGetInt32(out var n)) count = n;
                        else if (item.TryGetProperty("Count", out var ce2) && ce2.TryGetInt32(out var n2)) count = n2;
                        if (count > 0) effectBreakdown.Add(new PolicyEffectCountDto(NormalizeEffect(effect), count));
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "AzPolicyLens effect ARG query failed."); }
        }, cancellationToken);

        var exemptionsTask = Task.Run(async () =>
        {
            try
            {
                using var result = await azureResourceGraphClient.QueryResourcesAsync(exemptionsQuery, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        if (item.TryGetProperty("count_", out var ce) && ce.TryGetInt32(out var n)) totalExemptions = n;
                        else if (item.TryGetProperty("Count", out var ce2) && ce2.TryGetInt32(out var n2)) totalExemptions = n2;
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "AzPolicyLens exemptions ARG query failed."); }
        }, cancellationToken);

        await Task.WhenAll(assignmentsTask, definitionsTask, effectTask, exemptionsTask);

        // 5. Policy Insights API: per-subscription compliance summary
        var subCompliance = new List<PolicySubComplianceDto>();
        var assignmentNonCompliantMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var assignmentSubCountMap = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        var totalNonCompliant = 0;
        var totalCompliant = 0;

        var complianceTasks = subscriptionIds.Select(async subId =>
        {
            try
            {
                using var result = await policyInsightsClient.SummarizeSubscriptionAsync(subId, cancellationToken);
                if (!result.RootElement.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Array)
                    return;

                foreach (var entry in value.EnumerateArray())
                {
                    var subNonCompliant = 0;
                    var subCompliantCount = 0;
                    var subExempt = 0;
                    var subConflict = 0;

                    if (entry.TryGetProperty("results", out var results))
                    {
                        if (results.TryGetProperty("nonCompliantResources", out var nc) && nc.TryGetInt32(out var ncVal))
                            subNonCompliant = ncVal;

                        if (results.TryGetProperty("resourceDetails", out var details) && details.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var detail in details.EnumerateArray())
                            {
                                var state = GetStringProperty(detail, "complianceState") ?? "";
                                var cnt = 0;
                                if (detail.TryGetProperty("count", out var ce) && ce.TryGetInt32(out var cv)) cnt = cv;
                                if (state.Equals("compliant", StringComparison.OrdinalIgnoreCase)) subCompliantCount += cnt;
                                else if (state.Equals("exempt", StringComparison.OrdinalIgnoreCase)) subExempt += cnt;
                                else if (state.Equals("conflict", StringComparison.OrdinalIgnoreCase)) subConflict += cnt;
                            }
                        }
                    }

                    // Per-assignment breakdown for top non-compliant list
                    if (entry.TryGetProperty("policyAssignments", out var assignments) && assignments.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var assignment in assignments.EnumerateArray())
                        {
                            var assignId = GetStringProperty(assignment, "policyAssignmentId") ?? "";
                            var assignNc = 0;
                            if (assignment.TryGetProperty("results", out var ar) &&
                                ar.TryGetProperty("nonCompliantResources", out var anc) &&
                                anc.TryGetInt32(out var ancVal))
                                assignNc = ancVal;

                            if (!string.IsNullOrEmpty(assignId) && assignNc > 0)
                            {
                                lock (assignmentNonCompliantMap)
                                    assignmentNonCompliantMap[assignId] = assignmentNonCompliantMap.GetValueOrDefault(assignId, 0) + assignNc;
                                lock (assignmentSubCountMap)
                                {
                                    if (!assignmentSubCountMap.TryGetValue(assignId, out var subs))
                                    {
                                        subs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                                        assignmentSubCountMap[assignId] = subs;
                                    }
                                    subs.Add(subId);
                                }
                            }
                        }
                    }

                    var subName = subNameMap.GetValueOrDefault(subId, "Unknown Subscription");
                    var pct = (subNonCompliant + subCompliantCount) > 0
                        ? Math.Round((decimal)subCompliantCount / (subNonCompliant + subCompliantCount) * 100, 1)
                        : 100m;

                    lock (subCompliance)
                    {
                        subCompliance.Add(new PolicySubComplianceDto(subId, subName, subNonCompliant, subCompliantCount, pct, subExempt, subConflict));
                        totalNonCompliant += subNonCompliant;
                        totalCompliant += subCompliantCount;
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "AzPolicyLens Policy Insights summarize failed for subscription {SubId}.", subId); }
        });

        await Task.WhenAll(complianceTasks);

        var overallPct = (totalNonCompliant + totalCompliant) > 0
            ? Math.Round((decimal)totalCompliant / (totalNonCompliant + totalCompliant) * 100, 1)
            : 0m;

        // Build priority scores and top non-compliant assignments
        var maxNonCompliant = assignmentNonCompliantMap.Values.Any() ? assignmentNonCompliantMap.Values.Max() : 1;
        var totalSubscriptionCount = subscriptionIds.Length;

        var topAssignments = assignmentNonCompliantMap
            .Where(kv => kv.Value > 0)
            .Select(kv =>
            {
                var (displayName, scope, subId, rawEffect) = assignmentMap.TryGetValue(kv.Key, out var def)
                    ? def
                    : (kv.Key.Split('/').LastOrDefault() ?? "Unknown", "", "", "");
                var subName = subNameMap.GetValueOrDefault(subId, "Unknown Subscription");
                var subCount = assignmentSubCountMap.TryGetValue(kv.Key, out var subs) ? subs.Count : 1;
                var effect = string.IsNullOrEmpty(rawEffect) ? "Audit" : rawEffect;
                var priorityScore = CalculatePriorityScore(kv.Value, effect, subCount, maxNonCompliant, totalSubscriptionCount);
                return new PolicyAssignmentSummaryDto(kv.Key, displayName, scope, subName, kv.Value, priorityScore, subCount, NormalizeEffect(effect));
            })
            .OrderByDescending(a => a.PriorityScore)
            .Take(20)
            .ToArray();

        // Build category breakdown from assignment display names
        var categoryMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in assignmentNonCompliantMap.Where(x => x.Value > 0))
        {
            var displayName = assignmentMap.TryGetValue(kv.Key, out var d) ? d.DisplayName : "";
            var category = ClassifyPolicyCategory(displayName);
            categoryMap[category] = categoryMap.GetValueOrDefault(category, 0) + kv.Value;
        }
        var categoryBreakdown = categoryMap
            .Select(kv => new PolicyCategoryBreakdownDto(kv.Key, kv.Value))
            .OrderByDescending(c => c.NonCompliantResources)
            .ToArray();

        var nonCompliantAssignmentCount = assignmentNonCompliantMap.Count(kv => kv.Value > 0);
        var compliantAssignmentCount = Math.Max(0, assignmentMap.Count - nonCompliantAssignmentCount);

        return new AzPolicyLensDashboardDto(
            tenantId, DateTimeOffset.UtcNow,
            assignmentMap.Count, customDefinitionCount,
            totalNonCompliant, totalCompliant, overallPct,
            totalExemptions, compliantAssignmentCount, nonCompliantAssignmentCount,
            topAssignments,
            subCompliance.OrderBy(s => s.CompliancePercent).ToArray(),
            effectBreakdown.OrderByDescending(e => e.Count).ToArray(),
            categoryBreakdown);
    }

    public async Task<ManagedIdentityAuditDashboardDto> GetManagedIdentityAuditDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new ManagedIdentityAuditDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, []);

        var userAssigned = new List<ManagedIdentityItemDto>();
        var systemAssignedCount = 0;

        try
        {
            const string uaQuery = "resources | where type =~ 'microsoft.managedidentity/userassignedidentities' | project id, name, subscriptionId, location | order by name asc";
            using var ua = await azureResourceGraphClient.QueryResourcesAsync(uaQuery, subscriptionIds, null, cancellationToken);
            if (ua.RootElement.TryGetProperty("data", out var uad) && uad.ValueKind == JsonValueKind.Array)
                foreach (var item in uad.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    userAssigned.Add(new ManagedIdentityItemDto(GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "", "UserAssigned", 0));
                }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Managed identity ARG query failed."); }

        try
        {
            const string saQuery = "resources | where isnotempty(identity) and identity.type has 'SystemAssigned' | summarize Count=count()";
            using var sa = await azureResourceGraphClient.QueryResourcesAsync(saQuery, subscriptionIds, null, cancellationToken);
            if (sa.RootElement.TryGetProperty("data", out var sad) && sad.ValueKind == JsonValueKind.Array)
                foreach (var item in sad.EnumerateArray())
                    if (item.TryGetProperty("Count", out var cnt) && cnt.ValueKind == JsonValueKind.Number)
                        systemAssignedCount = cnt.GetInt32();
        }
        catch (Exception ex) { logger.LogWarning(ex, "System-assigned identity ARG query failed."); }

        return new ManagedIdentityAuditDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalUserAssigned: userAssigned.Count,
            TotalSystemAssigned: systemAssignedCount,
            UserAssignedIdentities: userAssigned.Take(100).ToArray());
    }

    // ── Azure Advisor Score ───────────────────────────────────────────────────
}
