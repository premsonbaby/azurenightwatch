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
    public async Task<ExecutiveDashboardDto> GetExecutiveDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var liveSubscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var liveSignals = await CollectLiveSignalsAsync(liveSubscriptions, cancellationToken);

        var securityScore = ClampScore(100m - (liveSignals.AnyAnyNsgCount * 15m) - (liveSignals.DefenderRecommendationCount * 1.5m));
        var noBackupPenalty = liveSignals.VmCount > 0
            ? Math.Min(30m, (liveSignals.VmCount - Math.Min(liveSignals.VmCount, liveSignals.BackupProtectedItemCount)) * 3m)
            : 0m;
        var reliabilityScore = liveSubscriptions.Count > 0
            ? ClampScore(100m - (liveSignals.HighAvailabilityAdvisorCount * 6m) - noBackupPenalty)
            : 0m;
        var governanceScore = liveSignals.TotalResourceCount > 0
            ? Math.Round((liveSignals.TagCompliancePercent + liveSignals.NamingCompliancePercent + liveSignals.LandingZoneCompliancePercent) / 3m, 2)
            : 0m;
        var costScore = liveSubscriptions.Count > 0 && liveSignals.CurrentMonthCost > 0
            ? ClampScore(90m - (liveSignals.CurrentMonthCost / Math.Max(1, liveSubscriptions.Count) / 1500m) - (liveSignals.CostSpikeAlerts.Count * 8m))
            : 0m;
        var performanceScore = liveSubscriptions.Count > 0
            ? ClampScore(100m - (liveSignals.PerformanceAdvisorCount * 8m) - (liveSignals.UnusedNicCount * 2m))
            : 0m;
        var overallScore = liveSubscriptions.Count > 0
            ? riskScoringService.CalculateOverallRiskScore(securityScore, reliabilityScore, governanceScore, costScore)
            : 0m;

        var trendPoints = liveSignals.CostTrend.Count > 0
            ? (IEnumerable<ScoreComponent>)liveSignals.CostTrend
                .Select(p => new ScoreComponent(p.Timestamp.ToString("MMM dd"), p.Value, "steady"))
                .ToArray()
            : BuildExecutiveTrend(overallScore);
        var impactEstimate = Math.Round(
            (liveSignals.CurrentMonthCost * 0.15m) +
            (liveSignals.PublicExposedResourceCount * 12000m) +
            (liveSignals.DefenderRecommendationCount * 1500m),
            2);

        var riskLevel = DetermineRiskLevel(liveSignals.PublicExposedResourceCount, liveSignals.DefenderRecommendationCount);
        var heatmapCells = liveSubscriptions
            .Select(subscription => new SubscriptionRiskHeatmapCell(
                subscription.Id,
                subscription.DisplayName,
                riskLevel,
                liveSubscriptions.Count > 0 ? Math.Round(impactEstimate / liveSubscriptions.Count, 2) : 0m))
            .ToArray();

        var statefulWorkloadCount = Math.Max(1, liveSignals.VmCount + liveSignals.DatabaseCount + liveSignals.StorageCount);
        var backupCoveragePercent = Math.Round(ClampScore((liveSignals.BackupProtectedItemCount * 100m) / statefulWorkloadCount), 1);

        var dataStatus = liveSubscriptions.Count == 0 ? DataStatus.Synthetic : DataStatus.Live;

        return new ExecutiveDashboardDto(
            tenantId,
            overallScore,
            securityScore,
            performanceScore,
            costScore,
            reliabilityScore,
            governanceScore,
            BuildExecutiveSummary(liveSignals, liveSubscriptions.Count),
            trendPoints,
            heatmapCells,
            impactEstimate,
            backupCoveragePercent,
            statefulWorkloadCount,
            liveSignals.BackupProtectedItemCount,
            dataStatus);
    }

    public Task<SmartFeaturesDto> GetSmartFeaturesAsync(string tenantId, CancellationToken cancellationToken)
    {
        return GetLiveSmartFeaturesAsync(cancellationToken);
    }

    public Task<IntegrationCatalogDto> GetIntegrationCatalogAsync(CancellationToken cancellationToken)
    {
        var dto = new IntegrationCatalogDto(
            "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01",
            "https://api.loganalytics.io/v1/workspaces/{workspaceId}/query",
            "https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Security/assessments?api-version=2020-01-01",
            "https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Advisor/recommendations?api-version=2023-01-01",
            "https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01",
            [
                "resources | where type =~ 'microsoft.network/networksecuritygroups' | mv-expand rule = properties.securityRules | where tostring(rule.properties.sourceAddressPrefix) == '*' and tostring(rule.properties.destinationPortRange) == '*' | project id, name",
                "resources | where isempty(tags) or bag_length(tags) == 0 | project id, name, type"
            ],
            [
                "AppRequests | where Success == false | summarize Failures=count()",
                "Perf | where ObjectName == 'Processor' and CounterName == '% Processor Time' | summarize Value=avg(CounterValue) by TimeGenerated=bin(TimeGenerated, 1h)"
            ]);

        return Task.FromResult(dto);
    }

    public Task<IReadOnlyCollection<TenantOverviewDto>> GetTenantOverviewAsync(CancellationToken cancellationToken)
    {
        return GetLiveTenantOverviewAsync(cancellationToken);
    }

}
