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
    public async Task<CostDashboardDto> GetCostDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var liveSubscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var liveSignals = await CollectLiveSignalsAsync(liveSubscriptions, cancellationToken);
        var currentCost = liveSignals.CurrentMonthCost;
        var predictedCost = currentCost > 0 ? Math.Round(currentCost * 0.96m, 2) : 0m;
        var recommendations = recommendationEngine.GenerateCostRecommendations(12m, currentCost);
        var normalizedRecommendations = recommendations.Count > 0
            ? recommendations
            :
            [
                new Recommendation(
                    "Review baseline cost hygiene",
                    "No optimization recommendations were generated from current telemetry; validate advisor data ingestion and rightsize review cadence.",
                    Math.Round(currentCost * 0.03m, 2),
                    RiskLevel.Low)
            ];
        var costTrend = liveSignals.CostTrend.Count > 0 ? liveSignals.CostTrend : BuildSyntheticTrend(30, 100m);
        var zombieResourceCount = liveSignals.UnusedDiskCount + liveSignals.UnusedNicCount + liveSignals.AbandonedPublicIpCount;

        var metrics = new[]
        {
            Metric("idleVms", "Idle VM Detection", liveSignals.CostAdvisorRecommendationCount, "recommendations", liveSignals.CostAdvisorRecommendationCount > 0 ? "live" : "limited", "Cost-related Azure Advisor recommendations observed for the current Azure scope."),
            Metric("unusedDisks", "Unused Disks", liveSignals.UnusedDiskCount, "count", StatusForCount(liveSignals.UnusedDiskCount), "Managed disks with no active attachment."),
            Metric("unusedNics", "Unused NICs", liveSignals.UnusedNicCount, "count", StatusForCount(liveSignals.UnusedNicCount), "Network interfaces not connected to a virtual machine."),
            Metric("unusedIps", "Unused Public IPs", liveSignals.AbandonedPublicIpCount, "count", StatusForCount(liveSignals.AbandonedPublicIpCount), "Public IP addresses not attached to active resources."),
            Metric("zombies", "Zombie Resources", zombieResourceCount, "count", StatusForCount(zombieResourceCount), "Aggregated count of unattached disks, NICs, and public IPs."),
            Metric("advisor", "Azure Advisor Opportunities", liveSignals.AdvisorRecommendationCount, "count", StatusForCount(liveSignals.AdvisorRecommendationCount), "Advisor recommendations across all categories for discovered subscriptions."),
        };

        return new CostDashboardDto(
            predictedCost,
            currentCost,
            normalizedRecommendations,
            costTrend,
            currentCost > 0 ? Math.Round(currentCost * 0.293m, 2) : 0m,
            metrics,
            liveSignals.CostSpikeAlerts,
            liveSignals.ReservedInstanceRecommendations,
            liveSignals.SavingsPlanSuggestions,
            liveSignals.CostCurrency);
    }

    public async Task<CostAnomalyForecastDashboardDto> GetCostAnomalyForecastDashboardAsync(string tenantId, string timeRange, CancellationToken cancellationToken)
    {
        var liveSubscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var liveSignals = await CollectLiveSignalsAsync(liveSubscriptions, cancellationToken);
        var normalizedRange = NormalizeCapacityRange(timeRange);
        var historyDays = normalizedRange switch
        {
            "7d" => 7,
            "30d" => 30,
            "90d" => 90,
            "6m" => 180,
            "1y" => 365,
            _ => 90
        };

        var cacheKey = $"cost-anomaly::{tenantId}::{normalizedRange}::{string.Join(',', liveSubscriptions.Select(subscription => subscription.Id).OrderBy(id => id, StringComparer.Ordinal))}";
        if (memoryCache.TryGetValue(cacheKey, out var cachedValue) && cachedValue is CostAnomalyForecastDashboardDto cachedDashboard)
        {
            return cachedDashboard;
        }

        var anomalyTrend = BuildCostAnomalyTrend(liveSignals, historyDays);
        var anomalies = BuildCostAnomalyItems(anomalyTrend);
        var budgetForecast = BuildBudgetBurnForecast(liveSignals, anomalyTrend);
        var anomalyCount = anomalies.Count;
        var maxDeviation = anomalies.Count > 0 ? anomalies.Max(item => item.DeviationPercent) : 0m;
        var recentBurn = Math.Round(anomalyTrend.OrderBy(point => point.Timestamp).TakeLast(7).Sum(point => point.ActualCost), 2);
        var variance = budgetForecast.ForecastVariance;

        var metrics = new[]
        {
            Metric("anomalyCount", "Detected Anomalies", anomalyCount, "events", anomalyCount > 0 ? "attention" : "healthy", "Detected spend spikes versus rolling baseline for the selected range."),
            Metric("maxDeviation", "Largest Deviation", maxDeviation, "%", maxDeviation >= 20m ? "attention" : "healthy", "Highest percentage deviation from expected baseline spend."),
            Metric("recentBurn", "7-Day Burn", recentBurn, liveSignals.CostCurrency, recentBurn > 0m ? "live" : "limited", "Rolling spend burn across the last 7 days."),
            Metric("projectedMonthEnd", "Projected Month-End", budgetForecast.ProjectedMonthEndCost, liveSignals.CostCurrency, budgetForecast.ProjectedMonthEndCost > budgetForecast.BudgetLimit ? "attention" : "healthy", "Forecasted month-end cost based on current burn rate."),
            Metric("budgetUtilization", "Budget Utilization", budgetForecast.BudgetUtilizationPercent, "%", budgetForecast.BudgetUtilizationPercent >= 95m ? "attention" : "healthy", "Projected utilization of configured monthly budget."),
            Metric("forecastVariance", "Forecast Variance", variance, liveSignals.CostCurrency, variance > 0m ? "attention" : "healthy", "Projected amount above or below monthly budget target."),
        };

        var insightCallout = anomalyCount == 0
            ? "No high-confidence anomalies were detected in the selected window. Keep the burn forecast in watch mode to catch trend reversals early."
            : $"{anomalyCount} anomalies were detected against baseline spend. Without remediation, forecasted month-end variance is {liveSignals.CostCurrency} {variance:N2}.";

        var recommendations = new List<string>
        {
            "Triage top anomaly windows within 24 hours and map each spike to workload, owner, and deployment event.",
            "Use budget burn projections to trigger pre-approved rightsizing and schedule controls before overrun dates.",
            "Set automated spend guardrails per environment so repeated spikes create tickets and escalation paths.",
        };

        if (liveSignals.CostSpikeAlerts.Count > 0)
        {
            recommendations.Add(liveSignals.CostSpikeAlerts.First());
        }

        var dashboard = new CostAnomalyForecastDashboardDto(
            "cost-anomaly-burn-forecast",
            "Cost Anomaly Detection & Budget Burn Forecast",
            $"Historical anomaly detection and predictive budget-burn forecast for the selected {normalizedRange} window.",
            normalizedRange,
            DateTimeOffset.UtcNow,
            metrics,
            anomalyTrend,
            anomalies,
            budgetForecast,
            recommendations.Take(6).ToArray(),
            insightCallout,
            variance > 0m
                ? "Month-end spend is projected above budget. Prioritize high-impact anomaly owners for immediate remediation."
                : "Current burn forecast remains within budget. Maintain weekly anomaly reviews to preserve this position.",
            "Run a weekly burn-review cadence with cost-center owners and validate every high-severity anomaly against deployment history.",
            "Combine rolling baseline detection with commitment coverage checks so anomaly remediation also improves unit economics.",
            liveSignals.CostCurrency);

        memoryCache.Set(cacheKey, dashboard, TimeSpan.FromSeconds(30));
        return dashboard;
    }

    public async Task<TopCostlyResourcesDashboardDto> GetTopCostlyResourcesDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions
            .Select(s => s.Id)
            .Where(IsUsableSubscriptionId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var cacheKey = $"top-costly::{tenantId}::{string.Join(',', subscriptionIds.OrderBy(id => id, StringComparer.Ordinal))}::g{cacheBustService.Generation}";
        if (memoryCache.TryGetValue(cacheKey, out var cached) && cached is TopCostlyResourcesDashboardDto hit)
        {
            return hit;
        }

        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        var (snapshots, costCurrency) = subscriptionIds.Length > 0
            ? await GetCurrentMonthCostByResourceAsync(subscriptionIds, cancellationToken)
            : (Array.Empty<ResourceCostSnapshot>(), "EUR");

        var top10 = snapshots
            .OrderByDescending(s => s.MonthlyCost)
            .Take(10)
            .Select(s =>
            {
                var parts = s.ResourceId.Split('/', StringSplitOptions.RemoveEmptyEntries);
                var resourceName = parts.Length > 0 ? parts[^1] : s.ResourceId;
                var subName = subNameMap.TryGetValue(s.SubscriptionId, out var name) ? name : s.SubscriptionId;
                return new TopCostlyResourceDto(s.ResourceId, resourceName, s.ResourceType, s.SubscriptionId, subName, s.MonthlyCost);
            })
            .ToArray();

        var total = Math.Round(top10.Sum(r => r.MonthlyCostEur), 2);
        var dashboard = new TopCostlyResourcesDashboardDto(tenantId, top10, total, DateTimeOffset.UtcNow, costCurrency);
        memoryCache.Set(cacheKey, dashboard, TimeSpan.FromMinutes(5));
        return dashboard;
    }

    public async Task<WastageTrackerDashboardDto> GetWastageTrackerDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var orphaned = await GetOrphanedResourcesDashboardAsync(tenantId, cancellationToken);

        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        var idleVmItems = new List<WastageItemDto>();
        var stoppedVmItems = new List<WastageItemDto>();

        if (subscriptionIds.Length > 0)
        {
            // Join Advisor recommendations against live VM power state so deallocated VMs are excluded
            const string idleVmQuery = "advisorresources | where type =~ 'microsoft.advisor/recommendations' | where properties.category =~ 'Cost' | where properties.impactedField =~ 'Microsoft.Compute/virtualMachines' | extend vmResourceId=tolower(tostring(properties.resourceMetadata.resourceId)) | join kind=leftsemi (resources | where type =~ 'microsoft.compute/virtualmachines' | extend ps=tostring(properties.extended.instanceView.powerState.code) | where ps !~ 'PowerState/deallocated' | project id=tolower(id)) on $left.vmResourceId == $right.id | project id, name=tostring(properties.impactedValue), subscriptionId, savings=toreal(properties.extendedProperties.annualSavingsAmount) | where savings > 0 | order by savings desc | take 20";
            // Explicit guard: stopped = OS-level shutdown but Azure-allocated; deallocated = no compute charge
            const string stoppedVmQuery = "resources | where type =~ 'microsoft.compute/virtualmachines' | extend ps=tostring(properties.extended.instanceView.powerState.code) | where ps =~ 'PowerState/stopped' and ps !~ 'PowerState/deallocated' | project id, name, subscriptionId, vmSize=tostring(properties.hardwareProfile.vmSize)";

            try
            {
                using var result = await azureResourceGraphClient.QueryResourcesAsync(idleVmQuery, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        var rid = GetStringProperty(item, "id") ?? "";
                        var name = GetStringProperty(item, "name") ?? "vm-resource";
                        var subId = GetStringProperty(item, "subscriptionId") ?? "";
                        decimal savings = 0m;
                        if (item.TryGetProperty("savings", out var sv) && sv.ValueKind == JsonValueKind.Number) savings = Math.Round((decimal)sv.GetDouble() / 12m, 2);
                        idleVmItems.Add(new WastageItemDto("Underutilized VM", name, rid, subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), savings, $"VM is running but underutilised — Azure Advisor estimates €{savings}/month savings by right-sizing or shutting down. This VM is actively allocated and billed."));
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "Wastage tracker idle-VM ARG query failed."); }

            try
            {
                using var result = await azureResourceGraphClient.QueryResourcesAsync(stoppedVmQuery, subscriptionIds, null, cancellationToken);
                if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in data.EnumerateArray())
                    {
                        var rid = GetStringProperty(item, "id") ?? "";
                        var name = GetStringProperty(item, "name") ?? "vm-resource";
                        var subId = GetStringProperty(item, "subscriptionId") ?? "";
                        var vmSize = GetStringProperty(item, "vmSize") ?? "";
                        // Estimate monthly cost by SKU family — stopped VMs still pay for compute allocation
                        decimal est = vmSize.ToLowerInvariant() switch
                        {
                            var s when s.Contains("standard_d") && s.Contains("v5") => 80m,
                            var s when s.Contains("standard_d") => 60m,
                            var s when s.Contains("standard_e") => 120m,
                            var s when s.Contains("standard_f") => 50m,
                            var s when s.Contains("standard_b") => 20m,
                            var s when s.Contains("standard_m") => 300m,
                            var s when s.Contains("standard_n") => 400m,
                            _ => 40m
                        };
                        stoppedVmItems.Add(new WastageItemDto("Stopped VM", name, rid, subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), est, $"VM is stopped (not deallocated) — Azure still charges for compute allocation. SKU: {vmSize}"));
                    }
                }
            }
            catch (Exception ex) { logger.LogWarning(ex, "Wastage tracker stopped-VM ARG query failed."); }
        }

        var orphanItems = orphaned.Resources.Select(r => new WastageItemDto(r.Category, r.Name, r.ResourceId, r.SubscriptionName, r.EstimatedMonthlyWasteEur, $"{r.Category} — not attached to any active workload.")).ToList();
        var allItems = idleVmItems.Concat(stoppedVmItems).Concat(orphanItems).OrderByDescending(i => i.EstimatedMonthlyWasteEur).ToArray();
        var totalWaste = Math.Round(allItems.Sum(i => i.EstimatedMonthlyWasteEur), 2);

        return new WastageTrackerDashboardDto(tenantId, DateTimeOffset.UtcNow, totalWaste, allItems.Length, allItems);
    }

    public async Task<SubscriptionCostDashboardDto> GetSubscriptionCostDashboardAsync(string tenantId, int months, CancellationToken cancellationToken)
    {
        var normalizedMonths = months switch { 3 or 6 or 12 => months, _ => 3 };

        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions
            .Select(s => s.Id)
            .Where(IsUsableSubscriptionId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var cacheKey = $"sub-cost::{tenantId}::{normalizedMonths}::{string.Join(',', subscriptionIds.OrderBy(id => id, StringComparer.Ordinal))}::g{cacheBustService.Generation}";
        if (memoryCache.TryGetValue(cacheKey, out var cached) && cached is SubscriptionCostDashboardDto hit)
            return hit;

        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var from = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(-(normalizedMonths - 1));
        var to = now;

        // Collect daily costs per subscription in parallel
        var subMonthlyCosts = new Dictionary<string, Dictionary<int, decimal>>(StringComparer.OrdinalIgnoreCase);
        var detectedCurrency = "EUR";
        if (subscriptionIds.Length > 0)
        {
            var tasks = subscriptionIds.Select(async subId =>
            {
                try
                {
                    using var doc = await costManagementClient.QueryCostAsync(subId, from, to, cancellationToken);
                    var currency = ExtractCurrencyFromResult(doc.RootElement);
                    return (subId, rows: ParseDailyCostIntoMonthly(doc.RootElement), currency);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Subscription cost query failed for {SubId}", subId);
                    return (subId, rows: new Dictionary<int, decimal>(), currency: "EUR");
                }
            });

            foreach (var (subId, rows, currency) in await Task.WhenAll(tasks))
            {
                subMonthlyCosts[subId] = rows;
                if (currency != "EUR") detectedCurrency = currency;
            }
        }

        // Build month-by-month breakdown across the requested window
        var monthlyBreakdown = new List<SubscriptionCostMonthDto>();
        for (var i = 0; i < normalizedMonths; i++)
        {
            var monthDate = from.AddMonths(i);
            var yearMonth = monthDate.Year * 100 + monthDate.Month;
            var monthLabel = monthDate.ToString("MMM yyyy", CultureInfo.InvariantCulture);
            var monthKey = $"{monthDate.Year:D4}-{monthDate.Month:D2}";

            var subCosts = subscriptionIds
                .Select(subId =>
                {
                    var cost = subMonthlyCosts.TryGetValue(subId, out var m) && m.TryGetValue(yearMonth, out var c) ? c : 0m;
                    var name = subNameMap.TryGetValue(subId, out var n) ? n : subId;
                    return new SubscriptionMonthCostDto(subId, name, cost);
                })
                .Where(s => s.CostEur > 0)
                .OrderByDescending(s => s.CostEur)
                .ToArray();

            monthlyBreakdown.Add(new SubscriptionCostMonthDto(monthKey, monthLabel, Math.Round(subCosts.Sum(s => s.CostEur), 2), subCosts));
        }

        // Build per-subscription summary
        var summaries = subscriptionIds
            .Select(subId =>
            {
                var name = subNameMap.TryGetValue(subId, out var n) ? n : subId;
                var monthCosts = monthlyBreakdown
                    .Select(m => m.Subscriptions.FirstOrDefault(s => s.SubscriptionId.Equals(subId, StringComparison.OrdinalIgnoreCase))?.CostEur ?? 0m)
                    .ToArray();
                var total = Math.Round(monthCosts.Sum(), 2);
                var avg = normalizedMonths > 0 ? Math.Round(total / normalizedMonths, 2) : 0m;
                var peak = monthCosts.Length > 0 ? monthCosts.Max() : 0m;
                var peakIdx = Array.IndexOf(monthCosts, peak);
                var peakMonth = peakIdx >= 0 && peakIdx < monthlyBreakdown.Count ? monthlyBreakdown[peakIdx].MonthLabel : string.Empty;
                return new SubscriptionCostSummaryDto(subId, name, total, avg, peak, peakMonth);
            })
            .Where(s => s.TotalCostEur > 0)
            .OrderByDescending(s => s.TotalCostEur)
            .ToArray();

        var grandTotal = Math.Round(summaries.Sum(s => s.TotalCostEur), 2);
        var avgMonthly = normalizedMonths > 0 ? Math.Round(grandTotal / normalizedMonths, 2) : 0m;
        var currentMonthCost = monthlyBreakdown.Count > 0 ? monthlyBreakdown[^1].TotalCostEur : 0m;

        var dashboard = new SubscriptionCostDashboardDto(
            tenantId, normalizedMonths, DateTimeOffset.UtcNow,
            grandTotal, avgMonthly, currentMonthCost,
            monthlyBreakdown, summaries, detectedCurrency);

        memoryCache.Set(cacheKey, dashboard, TimeSpan.FromMinutes(10));
        return dashboard;
    }

    // Parses daily Cost Management response (Daily granularity) and returns a map of YYYYMM → total cost.
    private static Dictionary<int, decimal> ParseDailyCostIntoMonthly(JsonElement element)
    {
        var result = new Dictionary<int, decimal>();

        if (!element.TryGetProperty("properties", out var props) ||
            !props.TryGetProperty("columns", out var columns) || columns.ValueKind != JsonValueKind.Array ||
            !props.TryGetProperty("rows", out var rows) || rows.ValueKind != JsonValueKind.Array)
            return result;

        var costIndex = FindNumericValueColumnIndex(columns);
        var dateIndex = FindColumnIndex(columns, "UsageDate");
        if (costIndex < 0 || dateIndex < 0)
            return result;

        foreach (var row in rows.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Array || row.GetArrayLength() <= Math.Max(costIndex, dateIndex))
                continue;
            if (!TryParseDecimal(row[costIndex], out var cost))
                continue;
            // UsageDate is YYYYMMDD as a number — strip the day to get YYYYMM
            int yearMonth;
            if (row[dateIndex].ValueKind == JsonValueKind.Number && row[dateIndex].TryGetInt32(out var dateInt))
                yearMonth = dateInt / 100;
            else if (row[dateIndex].ValueKind == JsonValueKind.String &&
                     int.TryParse(row[dateIndex].GetString()?.Replace("-", ""), out dateInt))
                yearMonth = dateInt / 100;
            else
                continue;

            result[yearMonth] = result.TryGetValue(yearMonth, out var existing)
                ? Math.Round(existing + cost, 4)
                : Math.Round(cost, 4);
        }

        return result;
    }

    // ── Network Perimeter ────────────────────────────────────────────────────
    public async Task<NonProdUptimeDashboardDto> GetNonProdUptimeDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subNameMap = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        if (subscriptionIds.Length == 0)
            return new NonProdUptimeDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0m, []);

        const string query = "resources | where type =~ 'microsoft.compute/virtualmachines' | where name contains 'dev' or name contains 'test' or name contains 'uat' or name contains 'staging' or tags.Environment in~ ('dev', 'test', 'uat', 'staging', 'nonprod', 'non-prod') | extend vmSize=tostring(properties.hardwareProfile.vmSize) | project id, name, subscriptionId, vmSize";

        var vms = new List<NonProdVmDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var rid = GetStringProperty(item, "id") ?? "";
                    var name = GetStringProperty(item, "name") ?? "unknown";
                    var subId = GetStringProperty(item, "subscriptionId") ?? "";
                    var size = GetStringProperty(item, "vmSize") ?? "Unknown";
                    var env = name.Contains("dev", StringComparison.OrdinalIgnoreCase) ? "Development"
                        : name.Contains("test", StringComparison.OrdinalIgnoreCase) ? "Test"
                        : name.Contains("uat", StringComparison.OrdinalIgnoreCase) ? "UAT"
                        : "Non-Prod";
                    decimal cost = size.ToLowerInvariant() switch
                    {
                        var s when s.Contains("standard_d") => 80m,
                        var s when s.Contains("standard_b") => 25m,
                        var s when s.Contains("standard_e") => 150m,
                        _ => 50m
                    };
                    vms.Add(new NonProdVmDto(name, rid, subNameMap.GetValueOrDefault(subId, "Unknown Subscription"), env, size, cost));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Non-prod uptime ARG query failed."); }

        var leakage = Math.Round(vms.Sum(v => v.EstimatedMonthlyCostEur), 2);
        return new NonProdUptimeDashboardDto(tenantId, DateTimeOffset.UtcNow, vms.Count, vms.Count, leakage, vms);
    }

    // ── RI & Savings ─────────────────────────────────────────────────────────
    public async Task<RiSavingsDashboardDto> GetRiSavingsDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        if (subscriptionIds.Length == 0)
            return new RiSavingsDashboardDto(tenantId, DateTimeOffset.UtcNow, 0m, 0m, 0, []);

        // Only fetch genuine commitment-based recommendations (Reserved Instances, Savings Plans).
        // These always have 'term' in extendedProperties (e.g. "P1Y", "P3Y").
        // Shutdown, right-sizing, and other operational recommendations do NOT have 'term'
        // and belong in Wastage Tracker, not here.
        const string query = "advisorresources | where type =~ 'microsoft.advisor/recommendations' | where properties.category =~ 'Cost' | where isnotempty(tostring(properties.extendedProperties.term)) | extend annualSavings=toreal(properties.extendedProperties.annualSavingsAmount) | where annualSavings > 0 | project resourceType=tostring(properties.impactedField), impact=tostring(properties.impact), annualSavings, description=tostring(properties.shortDescription.solution), term=tostring(properties.extendedProperties.term) | order by annualSavings desc";

        var recs = new List<RiRecommendationDto>();
        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (result.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var rt = GetStringProperty(item, "resourceType") ?? "Compute";
                    var impact = GetStringProperty(item, "impact") ?? "Medium";
                    var description = GetStringProperty(item, "description") ?? "";
                    var term = GetStringProperty(item, "term") ?? "";
                    decimal annual = 0m;
                    if (item.TryGetProperty("annualSavings", out var av) && av.ValueKind == JsonValueKind.Number) annual = (decimal)av.GetDouble();
                    if (annual <= 0m) continue;
                    var monthly = Math.Round(annual / 12m, 2);
                    var recType = string.IsNullOrWhiteSpace(description) ? ClassifyAdvisorRecommendation(rt) : TruncateAdvisorDescription(description);
                    var termLabel = term switch { "P1Y" => "1 Year", "P3Y" => "3 Year", _ => term };
                    recs.Add(new RiRecommendationDto(rt, recType, termLabel, "", Math.Round(annual, 2), monthly, impact));
                }
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "RI savings ARG query failed."); }

        var totalAnnual = Math.Round(recs.Sum(r => r.EstimatedAnnualSavingsEur), 2);
        var totalMonthly = Math.Round(recs.Sum(r => r.EstimatedMonthlySavingsEur), 2);

        return new RiSavingsDashboardDto(tenantId, DateTimeOffset.UtcNow, totalAnnual, totalMonthly, recs.Count, recs.Take(20).ToArray());
    }

    // ── App & Functions Health ───────────────────────────────────────────────
}
