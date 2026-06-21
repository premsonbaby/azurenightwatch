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
    public async Task<ServiceHealthDashboardDto> GetServiceHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        var events = new List<ServiceHealthEventDto>();
        if (subscriptionIds.Length > 0)
        {
            try
            {
                const string query = @"healthresources
| where type =~ 'microsoft.resourcehealth/events'
| extend eventType = tostring(properties.eventType), status = tostring(properties.status)
| extend level = tostring(properties.level), title = tostring(properties.title)
| extend startTime = tostring(properties.activatedTime)
| project id, title, eventType, status, level, subscriptionId, startTime
| order by startTime desc | take 50";
                using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        var subId = GetStringProperty(item, "subscriptionId") ?? "";
                        var startStr = GetStringProperty(item, "startTime");
                        DateTimeOffset? startTime = startStr != null && DateTimeOffset.TryParse(startStr, out var parsed) ? parsed : (DateTimeOffset?)null;
                        events.Add(new ServiceHealthEventDto(
                            GetStringProperty(item, "id") ?? "", GetStringProperty(item, "title") ?? "Service Event",
                            GetStringProperty(item, "eventType") ?? "Informational", GetStringProperty(item, "status") ?? "Active",
                            "", subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "level") ?? "Informational", startTime));
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "Service health ARG query failed for tenant {TenantId}.", tenantId); }
        }

        return new ServiceHealthDashboardDto(tenantId, DateTimeOffset.UtcNow,
            ActiveIncidents: events.Count(e => e.EventType.Contains("ServiceIssue", StringComparison.OrdinalIgnoreCase)),
            PlannedMaintenance: events.Count(e => e.EventType.Contains("PlannedMaintenance", StringComparison.OrdinalIgnoreCase)),
            HealthAdvisories: events.Count(e => e.EventType.Contains("HealthAdvisory", StringComparison.OrdinalIgnoreCase)),
            SecurityAdvisories: events.Count(e => e.EventType.Contains("Security", StringComparison.OrdinalIgnoreCase)),
            Events: events.ToArray());
    }

    // ── Managed Identity Audit ────────────────────────────────────────────────
    public async Task<AdvisorScoreDashboardDto> GetAdvisorScoreDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        var categories = new List<AdvisorScoreCategoryDto>();
        if (subscriptionIds.Length > 0)
        {
            try
            {
                const string query = @"advisorresources
| where type =~ 'microsoft.advisor/advisorscores'
| extend category = tostring(properties.advisory_category)
| extend score = todouble(properties.current_score)
| extend impacted = toint(properties.impacted_resource_count)
| extend potential = toint(properties.potential_score_increase)
| project category, score, impacted, potential | order by category asc";
                using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        var cat = GetStringProperty(item, "category") ?? "Overall";
                        var score = item.TryGetProperty("score", out var sc) && sc.ValueKind == JsonValueKind.Number ? (decimal)sc.GetDouble() : 0m;
                        var impacted = item.TryGetProperty("impacted", out var imp) && imp.ValueKind == JsonValueKind.Number ? imp.GetInt32() : 0;
                        var potential = item.TryGetProperty("potential", out var pot) && pot.ValueKind == JsonValueKind.Number ? pot.GetInt32() : 0;
                        categories.Add(new AdvisorScoreCategoryDto(cat, Math.Round(score, 1), impacted, potential));
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "Advisor score ARG query failed for tenant {TenantId}.", tenantId); }
        }

        var overall = categories.Count > 0 ? Math.Round(categories.Average(c => c.Score), 1) : 0m;
        return new AdvisorScoreDashboardDto(tenantId, DateTimeOffset.UtcNow, overall, categories.ToArray());
    }

    // ── Messaging Health ─────────────────────────────────────────────────────
    public async Task<MessagingHealthDashboardDto> GetMessagingHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new MessagingHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, [], []);

        var serviceBus = new List<ServiceBusNamespaceDto>();
        var eventHubs = new List<EventHubNamespaceDto>();

        try
        {
            const string sbQuery = "resources | where type =~ 'microsoft.servicebus/namespaces' | extend skuName = tostring(sku.name), status = tostring(properties.status) | project id, name, subscriptionId, location, skuName, status | order by name asc";
            using var sr = await azureResourceGraphClient.QueryResourcesAsync(sbQuery, subscriptionIds, null, cancellationToken);
            if (sr.RootElement.TryGetProperty("data", out var sd) && sd.ValueKind == JsonValueKind.Array)
                foreach (var item in sd.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    serviceBus.Add(new ServiceBusNamespaceDto(GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "", GetStringProperty(item, "skuName") ?? "", GetStringProperty(item, "status") ?? "Active"));
                }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Service bus ARG query failed."); }

        try
        {
            const string ehQuery = "resources | where type =~ 'microsoft.eventhub/namespaces' | extend skuName = tostring(sku.name), throughput = toint(properties.maximumThroughputUnits) | project id, name, subscriptionId, location, skuName, throughput | order by name asc";
            using var er = await azureResourceGraphClient.QueryResourcesAsync(ehQuery, subscriptionIds, null, cancellationToken);
            if (er.RootElement.TryGetProperty("data", out var ed) && ed.ValueKind == JsonValueKind.Array)
                foreach (var item in ed.EnumerateArray())
                {
                    var throughput = item.TryGetProperty("throughput", out var t) && t.ValueKind == JsonValueKind.Number ? t.GetInt32() : 0;
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    eventHubs.Add(new EventHubNamespaceDto(GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "", GetStringProperty(item, "skuName") ?? "", throughput));
                }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Event hub ARG query failed."); }

        return new MessagingHealthDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalServiceBusNamespaces: serviceBus.Count, TotalEventHubNamespaces: eventHubs.Count,
            ServiceBusNamespaces: serviceBus.ToArray(), EventHubNamespaces: eventHubs.ToArray());
    }

    // ── Support Ticket Tracker ────────────────────────────────────────────────
    public Task<SupportTicketDashboardDto> GetSupportTicketDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        // Support tickets require Microsoft.Support ARM provider access which is not available via ARG.
        // Return an empty response; the UI will show an "All Clear" state.
        var result = new SupportTicketDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalOpenTickets: 0,
            CriticalCount: 0,
            HighCount: 0,
            ModeratCount: 0,
            MinimalCount: 0,
            Tickets: []);
        return Task.FromResult(result);
    }

    // ── Azure Monitor Alerts ──────────────────────────────────────────────────
    public async Task<AlertsDashboardDto> GetAlertsDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new AlertsDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, 0, 0, 0, 0, [], []);

        const string query = @"alertsmanagementresources
| where type =~ 'microsoft.alertsmanagement/alerts'
| where properties.essentials.alertState !~ 'Closed'
| extend severity = tostring(properties.essentials.severity)
| extend alertState = tostring(properties.essentials.alertState)
| extend monitorCondition = tostring(properties.essentials.monitorCondition)
| extend targetResource = tostring(properties.essentials.targetResource)
| extend targetResourceType = tostring(properties.essentials.targetResourceType)
| extend monitorService = tostring(properties.essentials.monitorService)
| extend startDateTime = tostring(properties.essentials.startDateTime)
| project id, name, subscriptionId, severity, alertState, monitorCondition, targetResource, targetResourceType, monitorService, startDateTime
| order by severity asc, startDateTime desc
| take 200";

        var alerts = new List<AlertItemDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var alertId = GetStringProperty(item, "id") ?? "";
                    var name = GetStringProperty(item, "name") ?? alertId;
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var severity = GetStringProperty(item, "severity") ?? "Sev3";
                    var alertState = GetStringProperty(item, "alertState") ?? "New";
                    var monitorCondition = GetStringProperty(item, "monitorCondition") ?? "Fired";
                    var targetResource = GetStringProperty(item, "targetResource") ?? "";
                    var targetResourceType = GetStringProperty(item, "targetResourceType") ?? "";
                    var monitorService = GetStringProperty(item, "monitorService") ?? "Platform";
                    var startStr = GetStringProperty(item, "startDateTime") ?? "";
                    DateTimeOffset fired = DateTimeOffset.UtcNow;
                    if (!string.IsNullOrEmpty(startStr)) DateTimeOffset.TryParse(startStr, out fired);
                    var subName = subNameMap.GetValueOrDefault(subId, "Unknown Subscription");
                    alerts.Add(new AlertItemDto(alertId, name, severity, alertState, monitorCondition, targetResource, targetResourceType, monitorService, subName, fired));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Alert ARG query failed for tenant {TenantId}.", tenantId); }

        var byService = alerts.GroupBy(a => a.MonitorService, StringComparer.OrdinalIgnoreCase)
            .Select(g => new AlertServiceCountDto(g.Key, g.Count()))
            .OrderByDescending(s => s.Count).ToArray();

        return new AlertsDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalActive: alerts.Count,
            Sev0Count: alerts.Count(a => a.Severity.Equals("Sev0", StringComparison.OrdinalIgnoreCase)),
            Sev1Count: alerts.Count(a => a.Severity.Equals("Sev1", StringComparison.OrdinalIgnoreCase)),
            Sev2Count: alerts.Count(a => a.Severity.Equals("Sev2", StringComparison.OrdinalIgnoreCase)),
            Sev3Count: alerts.Count(a => a.Severity.Equals("Sev3", StringComparison.OrdinalIgnoreCase)),
            Sev4Count: alerts.Count(a => a.Severity.Equals("Sev4", StringComparison.OrdinalIgnoreCase)),
            NewCount: alerts.Count(a => a.AlertState.Equals("New", StringComparison.OrdinalIgnoreCase)),
            AcknowledgedCount: alerts.Count(a => a.AlertState.Equals("Acknowledged", StringComparison.OrdinalIgnoreCase)),
            ByService: byService,
            Alerts: alerts.Take(150).ToArray());
    }

    // ── VMSS Health ───────────────────────────────────────────────────────────
    public async Task<VmssHealthDashboardDto> GetVmssHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new VmssHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0, []);

        const string query = @"resources
| where type =~ 'microsoft.compute/virtualmachinescalesets'
| extend skuName = tostring(sku.name), capacity = toint(sku.capacity)
| extend state = tostring(properties.provisioningState)
| extend upgradePolicy = tostring(properties.upgradePolicy.mode)
| project id, name, subscriptionId, location, skuName, capacity, state, upgradePolicy
| order by name asc";

        var scaleSets = new List<VmssItemDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var capacity = item.TryGetProperty("capacity", out var cap) && cap.ValueKind == JsonValueKind.Number ? cap.GetInt32() : 0;
                    scaleSets.Add(new VmssItemDto(
                        GetStringProperty(item, "id") ?? "", GetStringProperty(item, "name") ?? "",
                        subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), GetStringProperty(item, "location") ?? "",
                        GetStringProperty(item, "skuName") ?? "", capacity, GetStringProperty(item, "state") ?? "", GetStringProperty(item, "upgradePolicy") ?? "Manual"));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "VMSS health ARG query failed for tenant {TenantId}.", tenantId); }

        return new VmssHealthDashboardDto(tenantId, DateTimeOffset.UtcNow,
            TotalScaleSets: scaleSets.Count,
            RunningCount: scaleSets.Count(s => s.ProvisioningState.Equals("Succeeded", StringComparison.OrdinalIgnoreCase)),
            FailedCount: scaleSets.Count(s => s.ProvisioningState.Equals("Failed", StringComparison.OrdinalIgnoreCase)),
            TotalInstances: scaleSets.Sum(s => s.Capacity),
            ScaleSets: scaleSets.Take(100).ToArray());
    }

    // ── Express Route ─────────────────────────────────────────────────────────
}
