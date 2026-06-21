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
    public async Task<PerformanceDashboardDto> GetPerformanceDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var liveSubscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var liveSignals = await CollectLiveSignalsAsync(liveSubscriptions, cancellationToken);
        var dependencyGraph = BuildDependencyGraph(liveSubscriptions, liveSignals);

        var outagePredictions = new List<string>();
        if (!liveSignals.HasMonitorTelemetry)
        {
            outagePredictions.Add("Azure Monitor workspace telemetry is not configured, so predictive outage analysis is limited.");
        }
        else if (liveSignals.AppFailureCount > 0)
        {
            outagePredictions.Add($"Application Insights-style failure tracking shows {liveSignals.AppFailureCount} failed requests in the current window.");
        }
        else
        {
            outagePredictions.Add("No application request failures were returned from the configured Log Analytics workspace.");
        }

        if (liveSignals.AnyAnyNsgCount > 0)
        {
            outagePredictions.Add("Security exposure and operational drift may amplify the blast radius of a regional incident.");
        }

        var metrics = new[]
        {
            Metric("cpuSeries", "CPU Anomaly Samples", liveSignals.CpuTrend.Count, "samples", liveSignals.CpuTrend.Count > 0 ? "live" : "limited", "Observed CPU trend points from Log Analytics performance counters."),
            Metric("diskSeries", "Disk Latency Samples", liveSignals.DiskLatencyTrend.Count, "samples", liveSignals.DiskLatencyTrend.Count > 0 ? "live" : "limited", "Observed disk latency trend points from Log Analytics performance counters."),
            Metric("networkSeries", "Network Bottleneck Samples", liveSignals.NetworkTrend.Count, "samples", liveSignals.NetworkTrend.Count > 0 ? "live" : "limited", "Observed network throughput trend points from Log Analytics performance counters."),
            Metric("appFailures", "Application Failures", liveSignals.AppFailureCount, "count", StatusForCount(liveSignals.AppFailureCount), "Failed application requests detected in AppRequests telemetry."),
            Metric("serviceHealth", "Service Health Signals", 0m, "count", "planned", "Azure Service Health integration has not been wired yet."),
        };

        var serviceHealthSignals = new[]
        {
            liveSignals.HasMonitorTelemetry
                ? "Live performance telemetry is connected through Azure Monitor / Log Analytics."
                : "Azure Monitor / Log Analytics is not configured for this environment.",
            "Azure Service Health integration is pending a dedicated client and endpoint wiring."
        };

        var regionalOutageImpacts = new[]
        {
            liveSubscriptions.Count > 0
                ? $"A shared regional incident would affect up to {liveSubscriptions.Count} discovered subscriptions in the current Azure scope."
                : "Regional outage impact cannot be estimated until subscriptions are discoverable.",
            liveSignals.StorageCount > 0 && liveSignals.DatabaseCount > 0
                ? "Storage and database dependencies are present, so regional recovery planning should include data-tier failover validation."
                : "No storage/database dependency counts were returned from the current Azure Resource Graph scope."
        };

        var cpuAvg = liveSignals.CpuTrend.Count > 0 ? liveSignals.CpuTrend.Average(p => p.Value) : 0m;
        var fragilityIndex = (int)Math.Min(100, (cpuAvg * 0.4m) + (liveSignals.DefenderRecommendationCount * 2m) + (liveSignals.AnyAnyNsgCount * 5m));
        var fragilityRating = fragilityIndex switch { <= 20 => "Resilient", <= 40 => "Stable", <= 60 => "Fragile", <= 80 => "At Risk", _ => "Critical" };
        var fragilityDrivers = new List<string>();
        if (cpuAvg > 70) fragilityDrivers.Add($"High average CPU utilisation ({cpuAvg:N0}%)");
        if (liveSignals.AnyAnyNsgCount > 0) fragilityDrivers.Add($"{liveSignals.AnyAnyNsgCount} permissive NSG rules increase blast radius");
        if (liveSignals.DefenderRecommendationCount > 0) fragilityDrivers.Add($"{liveSignals.DefenderRecommendationCount} active Defender recommendations");
        if (!liveSignals.HasMonitorTelemetry) fragilityDrivers.Add("No Monitor telemetry — blind spots in failure detection");
        if (fragilityDrivers.Count == 0) fragilityDrivers.Add("No significant fragility drivers detected");

        return new PerformanceDashboardDto(
            liveSignals.HasMonitorTelemetry && liveSignals.CpuTrend.Count > 0 ? 25m : 0m,
            liveSignals.CpuTrend,
            liveSignals.DiskLatencyTrend,
            liveSignals.NetworkTrend,
            outagePredictions,
            metrics,
            serviceHealthSignals,
            regionalOutageImpacts,
            dependencyGraph.Nodes,
            dependencyGraph.Edges,
            fragilityIndex,
            fragilityRating,
            fragilityDrivers);
    }

    public async Task<CapacityPlanningDashboardDto> GetCapacityPlanningDashboardAsync(string tenantId, string timeRange, CancellationToken cancellationToken)
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

        var cacheKey = $"capacity::{tenantId}::{normalizedRange}::{string.Join(',', liveSubscriptions.Select(subscription => subscription.Id).OrderBy(id => id, StringComparer.Ordinal))}";
        if (memoryCache.TryGetValue(cacheKey, out var cachedValue) && cachedValue is CapacityPlanningDashboardDto cachedDashboard)
        {
            return cachedDashboard;
        }

        var resourceBlueprints = BuildCapacityBlueprints(liveSubscriptions);
        var cpuTrend = BuildCapacityTrendSeries(resourceBlueprints, historyDays, normalizedRange, "cpu", 72m, 1.15m, 2.4m);
        var memoryTrend = BuildCapacityTrendSeries(resourceBlueprints, historyDays, normalizedRange, "memory", 68m, 1.0m, 2.1m);
        var diskTrend = BuildCapacityTrendSeries(resourceBlueprints, historyDays, normalizedRange, "disk", 60m, 0.85m, 1.7m);

        var resources = resourceBlueprints
            .Select(blueprint => BuildCapacityResourceForecast(blueprint, historyDays))
            .OrderByDescending(resource => resource.EstimatedMonthlyWaste)
            .ThenBy(resource => resource.EstimatedHeadroomDays)
            .Take(8)
            .ToArray();

        var headroomTimeline = resources
            .OrderBy(resource => resource.EstimatedHeadroomDays <= 0 ? int.MaxValue : resource.EstimatedHeadroomDays)
            .Select(resource => new CapacityHeadroomDto(
                resource.ResourceName,
                resource.Status.Contains("Disk", StringComparison.OrdinalIgnoreCase) ? "Disk" : "CPU",
                resource.SaturationDate,
                resource.EstimatedHeadroomDays,
                resource.Status))
            .ToArray();

        var saturationCount = resources.Count(resource => resource.EstimatedHeadroomDays is <= 90 and > 0);
        var overThresholdCount = resources.Count(resource => resource.CpuCurrent >= 80m || resource.MemoryCurrent >= 80m || resource.DiskCurrent >= 80m);
        var avgCpu = resources.Any() ? Math.Round(resources.Average(resource => resource.CpuCurrent), 2) : 0m;
        var avgMemory = resources.Any() ? Math.Round(resources.Average(resource => resource.MemoryCurrent), 2) : 0m;
        var avgDisk = resources.Any() ? Math.Round(resources.Average(resource => resource.DiskCurrent), 2) : 0m;
        var totalMonthlyWaste = Math.Round(resources.Sum(resource => resource.EstimatedMonthlyWaste), 2);

        var metrics = new[]
        {
            Metric("cpuAvg", "Average CPU", avgCpu, "%", avgCpu >= 80m ? "attention" : "healthy", "Average CPU utilization across tracked capacity scopes."),
            Metric("memoryAvg", "Average Memory", avgMemory, "%", avgMemory >= 80m ? "attention" : "healthy", "Average memory utilization across tracked capacity scopes."),
            Metric("diskAvg", "Average Disk", avgDisk, "%", avgDisk >= 80m ? "attention" : "healthy", "Average disk utilization across tracked capacity scopes."),
            Metric("nearSaturation", "Near Saturation", saturationCount, "resources", saturationCount > 0 ? "attention" : "healthy", "Resources projected to breach 80% within 90 days."),
            Metric("waste", "Monthly Waste", totalMonthlyWaste, "EUR", totalMonthlyWaste > 0 ? "attention" : "healthy", "Estimated waste if overprovisioned resources remain unchanged."),
            Metric("overThreshold", "Over Threshold", overThresholdCount, "resources", overThresholdCount > 0 ? "attention" : "healthy", "Resources already at or above the 80% utilization threshold."),
        };

        var insightCallout = resources.Length == 0
            ? "No capacity telemetry could be derived from the current Azure scope. Grant broader Reader access or wire resource group inventory to activate forecasting."
            : resources.Any(resource => resource.EstimatedHeadroomDays <= 30 && resource.EstimatedHeadroomDays > 0)
                ? $"Several resources are approaching saturation within the next month. Rebalance the hottest subscriptions and resource groups first, then review the top waste candidates before the next scale event."
                : $"The current capacity trend is stable, but {saturationCount} resources are within a 90-day saturation window. Use the forecast chart to rightsize early and preserve headroom before growth compounds.";

        var recommendations = new List<string>
        {
            "Resize the highest-risk resources before they cross the 80% utilization threshold.",
            "Review the headroom timeline weekly and move resources with fewer than 30 days of headroom first.",
            "Keep the forecast band under watch for the next 30/60/90-day growth projection.",
        };

        var runwayForecast = resources
            .Where(r => r.EstimatedHeadroomDays > 0)
            .OrderBy(r => r.EstimatedHeadroomDays)
            .Take(10)
            .Select(r => new CapacityRunwayItemDto(
                r.ResourceName,
                "Virtual Machine",
                "CPU",
                r.EstimatedHeadroomDays,
                r.CpuCurrent,
                r.EstimatedHeadroomDays <= 7 ? "Critical" : r.EstimatedHeadroomDays <= 30 ? "High" : r.EstimatedHeadroomDays <= 60 ? "Medium" : "Low"))
            .ToList();

        var dashboard = new CapacityPlanningDashboardDto(
            "capacity-planning",
            "Capacity Planning & Resource Forecast",
            $"Capacity history and forecast view for the selected {normalizedRange} range across live Azure subscriptions.",
            normalizedRange,
            DateTimeOffset.UtcNow,
            metrics,
            [cpuTrend, memoryTrend, diskTrend],
            resources,
            headroomTimeline,
            recommendations,
            insightCallout,
            $"Prioritize the {resources.FirstOrDefault()?.ResourceName ?? "largest resource"} capacity review to reduce near-term saturation risk.",
            "Track the forecast band and headroom dates weekly so scale actions happen before utilization crosses safe thresholds.",
            "Use the trend deltas as an early-warning system; every forecasted breach is a chance to rightsize before the platform becomes noisy or expensive.",
            runwayForecast);

        memoryCache.Set(cacheKey, dashboard, TimeSpan.FromSeconds(30));
        return dashboard;
    }

}
