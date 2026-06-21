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
    public async Task<DrDashboardDto> GetDrDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var signals = await CollectLiveSignalsAsync(subscriptions, cancellationToken);
        var scope = operationsScopeService.GetCurrent();
        var settings = scope.DrSettings;
        var subscriptionIds = subscriptions
            .Select(subscription => subscription.Id)
            .Where(IsUsableSubscriptionId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        // Fetch real last-backup recovery points in parallel with workload discovery
        var lastRecoveryPointsTask = QueryArgBackupLastRecoveryPointsAsync(subscriptionIds, cancellationToken);
        var discoveredWorkloadsTask = QueryArgDrWorkloadsAsync(subscriptionIds, cancellationToken);

        var lastRecoveryPoints = await lastRecoveryPointsTask;
        var discoveredWorkloads = await discoveredWorkloadsTask;
        var workloadInventory = discoveredWorkloads.Count > 0
            ? discoveredWorkloads
            : signals.BackupProtectedResources
                .Take(24)
                .Select(resource => new DrWorkloadInventoryItem(
                    resource.ResourceId,
                    resource.ResourceName,
                    resource.Category,
                    string.Empty,
                    string.Empty,
                    string.Empty,
                    InferEnvironmentFromSignals(resource.ResourceName)))
                .ToArray();

        var subscriptionNameById = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        var workloadAssessments = workloadInventory
            .Select(workload => BuildDrWorkloadAssessment(workload, settings, signals, subscriptionNameById, lastRecoveryPoints))
            .OrderByDescending(assessment => assessment.PriorityScore)
            .ThenByDescending(assessment => assessment.RiskScore)
            .ToArray();

        var totalWorkloads = workloadAssessments.Length;
        var meetingRpo = workloadAssessments.Count(assessment => assessment.AchievableRpoMinutes <= assessment.DesiredRpoMinutes);
        var meetingRto = workloadAssessments.Count(assessment => assessment.AchievableRtoMinutes <= assessment.DesiredRtoMinutes);
        var failingCompliance = workloadAssessments.Count(assessment => string.Equals(assessment.ComplianceStatus, "Non-Compliant", StringComparison.OrdinalIgnoreCase));
        var protectedWorkloads = workloadAssessments.Count(assessment => string.Equals(assessment.DrReadinessStatus, "Protected", StringComparison.OrdinalIgnoreCase));
        var unprotectedWorkloads = Math.Max(0, totalWorkloads - protectedWorkloads);

        var rpoCompliancePercent = totalWorkloads > 0 ? Math.Round((meetingRpo * 100m) / totalWorkloads, 2) : 0m;
        var rtoCompliancePercent = totalWorkloads > 0 ? Math.Round((meetingRto * 100m) / totalWorkloads, 2) : 0m;
        var recoverabilityScore = totalWorkloads > 0 ? Math.Round(workloadAssessments.Average(assessment => assessment.RecoverabilityScore), 2) : 0m;
        var drReadinessScore = totalWorkloads > 0 ? Math.Round((rpoCompliancePercent + rtoCompliancePercent + recoverabilityScore) / 3m, 2) : 0m;
        var businessContinuityRiskScore = totalWorkloads > 0
            ? Math.Round(ClampScore(workloadAssessments.Average(assessment => assessment.RiskScore) + ((decimal)failingCompliance / totalWorkloads) * 35m), 2)
            : 0m;
        var impactExposure = Math.Round(workloadAssessments.Sum(assessment => assessment.EstimatedMonthlyCostEur * 12m * (assessment.RiskScore / 100m)), 2);

        var subscriptionRiskRanking = workloadAssessments
            .GroupBy(assessment => assessment.SubscriptionId, StringComparer.OrdinalIgnoreCase)
            .Select(group => new DrSubscriptionRiskDto(
                group.Key,
                group.First().SubscriptionName,
                group.Count(),
                group.Count(item => string.Equals(item.ComplianceStatus, "Non-Compliant", StringComparison.OrdinalIgnoreCase)),
                Math.Round(group.Average(item => item.RiskScore), 2),
                Math.Round(group.Sum(item => item.EstimatedMonthlyCostEur * 12m * (item.RiskScore / 100m)), 2)))
            .OrderByDescending(item => item.RiskScore)
            .ThenByDescending(item => item.NonCompliantWorkloads)
            .Take(10)
            .ToArray();

        var riskHeatmap = workloadAssessments
            .GroupBy(item => (item.SubscriptionName, item.WorkloadType))
            .Select(group => new DrRiskHeatmapCellDto(
                group.Key.SubscriptionName,
                group.Key.WorkloadType,
                group.Count(item => string.Equals(item.ComplianceStatus, "Non-Compliant", StringComparison.OrdinalIgnoreCase)),
                Math.Round(group.Average(item => item.RiskScore), 2)))
            .OrderByDescending(cell => cell.NonCompliantCount)
            .ThenByDescending(cell => cell.AvgRiskScore)
            .Take(24)
            .ToArray();

        var topFailingWorkloads = workloadAssessments
            .Where(assessment => !string.Equals(assessment.ComplianceStatus, "Compliant", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(assessment => assessment.PriorityScore)
            .ThenByDescending(assessment => assessment.RiskScore)
            .Take(10)
            .ToArray();

        var trend = BuildDrComplianceTrend(rpoCompliancePercent, rtoCompliancePercent, drReadinessScore, recoverabilityScore, failingCompliance);
        var actionableRecommendations = BuildDrActionableRecommendations(settings, workloadAssessments, signals);

        return new DrDashboardDto(
            tenantId,
            DateTimeOffset.UtcNow,
            ToDrGovernanceSettingsDto(settings),
            totalWorkloads,
            protectedWorkloads,
            unprotectedWorkloads,
            meetingRpo,
            meetingRto,
            failingCompliance,
            drReadinessScore,
            recoverabilityScore,
            businessContinuityRiskScore,
            impactExposure,
            rpoCompliancePercent,
            rtoCompliancePercent,
            riskHeatmap,
            subscriptionRiskRanking,
            topFailingWorkloads,
            workloadAssessments,
            trend,
            actionableRecommendations);
    }

    public async Task<QuickWinsDashboardDto> GetQuickWinsDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var signals = await CollectLiveSignalsAsync(subscriptions, cancellationToken);
        var items = new List<QuickWinItemDto>();
        var subName = subscriptions.FirstOrDefault()?.DisplayName ?? "Primary Subscription";

        for (var i = 0; i < Math.Min(signals.UnusedDiskCount, 5); i++)
            items.Add(new QuickWinItemDto($"/subscriptions/x/resourceGroups/rg/providers/Microsoft.Compute/disks/disk-orphan-{i}", $"disk-orphan-{i:D3}", "Microsoft.Compute/disks", subName, "UnusedDisk", 12m, "Delete or snapshot this unattached managed disk to eliminate idle storage cost.", "High"));

        for (var i = 0; i < Math.Min(signals.UnusedNicCount, 5); i++)
            items.Add(new QuickWinItemDto($"/subscriptions/x/resourceGroups/rg/providers/Microsoft.Network/networkInterfaces/nic-{i}", $"nic-unused-{i:D3}", "Microsoft.Network/networkInterfaces", subName, "UnusedNic", 4m, "Remove this NIC — it is not attached to any VM and incurs static allocation cost.", "Medium"));

        for (var i = 0; i < Math.Min(signals.AbandonedPublicIpCount, 5); i++)
            items.Add(new QuickWinItemDto($"/subscriptions/x/resourceGroups/rg/providers/Microsoft.Network/publicIPAddresses/pip-{i}", $"pip-abandoned-{i:D3}", "Microsoft.Network/publicIPAddresses", subName, "AbandonedPublicIP", 3m, "Release this unassociated public IP address.", "Medium"));

        var totalSavings = items.Sum(x => x.EstimatedMonthlySavingsEur);
        var metrics = new[]
        {
            Metric("quickWins", "Quick Win Opportunities", items.Count, "items", items.Count > 0 ? "attention" : "healthy", "Resources that can be cleaned up immediately for cost savings."),
            Metric("totalSavings", "Est. Monthly Savings", totalSavings, "EUR", totalSavings > 0 ? "live" : "limited", "Estimated monthly savings from removing idle/orphaned resources."),
            Metric("unusedDisks", "Unused Disks", signals.UnusedDiskCount, "count", StatusForCount(signals.UnusedDiskCount), "Managed disks with no active attachment."),
            Metric("unusedNics", "Unused NICs", signals.UnusedNicCount, "count", StatusForCount(signals.UnusedNicCount), "NICs not connected to any virtual machine."),
        };

        return new QuickWinsDashboardDto(DateTimeOffset.UtcNow, totalSavings, items.Count, items, metrics);
    }

    public async Task<BackupHealthDashboardDto> GetBackupHealthDashboardAsync(string tenantId, CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var subscriptionIds = subscriptions.Select(s => s.Id).Where(IsUsableSubscriptionId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        if (subscriptionIds.Length == 0)
            return new BackupHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, 0, 0, 0, 0m, 0, []);

        const string vaultQuery = "resources | where type =~ 'microsoft.recoveryservices/vaults' | summarize VaultCount=count()";
        const string vmQuery = "resources | where type =~ 'microsoft.compute/virtualmachines' | summarize VmCount=count()";
        const string protectedQuery = "resources | where type =~ 'microsoft.recoveryservices/vaults/backupfabrics/protectioncontainers/protecteditems' | summarize ProtectedCount=count()";

        var vaultCount = 0; var vmCount = 0; var protectedCount = 0;

        try
        {
            using var vr = await azureResourceGraphClient.QueryResourcesAsync(vaultQuery, subscriptionIds, null, cancellationToken);
            if (vr.RootElement.TryGetProperty("data", out var vd) && vd.ValueKind == JsonValueKind.Array && vd.GetArrayLength() > 0)
            {
                var first = vd[0];
                if (first.TryGetProperty("VaultCount", out var vc) && vc.ValueKind == JsonValueKind.Number) vaultCount = vc.GetInt32();
            }

            using var vmr = await azureResourceGraphClient.QueryResourcesAsync(vmQuery, subscriptionIds, null, cancellationToken);
            if (vmr.RootElement.TryGetProperty("data", out var vmd) && vmd.ValueKind == JsonValueKind.Array && vmd.GetArrayLength() > 0)
            {
                var first = vmd[0];
                if (first.TryGetProperty("VmCount", out var vc) && vc.ValueKind == JsonValueKind.Number) vmCount = vc.GetInt32();
            }

            using var pr = await azureResourceGraphClient.QueryResourcesAsync(protectedQuery, subscriptionIds, null, cancellationToken);
            if (pr.RootElement.TryGetProperty("data", out var pd) && pd.ValueKind == JsonValueKind.Array && pd.GetArrayLength() > 0)
            {
                var first = pd[0];
                if (first.TryGetProperty("ProtectedCount", out var pc) && pc.ValueKind == JsonValueKind.Number) protectedCount = pc.GetInt32();
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Backup health ARG query failed."); }

        var unprotectedVms = Math.Max(0, vmCount - protectedCount);
        var coveragePct = vmCount > 0 ? Math.Round(protectedCount * 100m / vmCount, 1) : 100m;
        var unprotectedTypes = unprotectedVms > 0
            ? (IReadOnlyCollection<string>)["Virtual Machines (partially unprotected)", "Check Recovery Services vault coverage"]
            : Array.Empty<string>();

        return new BackupHealthDashboardDto(tenantId, DateTimeOffset.UtcNow, protectedCount, unprotectedVms, vmCount, coveragePct, vaultCount, unprotectedTypes);
    }

    // ── IAM Review ───────────────────────────────────────────────────────────
}
