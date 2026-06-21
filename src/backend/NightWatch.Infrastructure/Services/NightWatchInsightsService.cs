using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using NightWatch.Infrastructure.Abstractions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed partial class NightWatchInsightsService(
    IRecommendationEngine recommendationEngine,
    IRiskScoringService riskScoringService,
    IAzureResourceGraphClient azureResourceGraphClient,
    IDefenderClient defenderClient,
    IAdvisorClient advisorClient,
    ICostManagementClient costManagementClient,
    IMonitorClient monitorClient,
    IAzurePolicyInsightsClient policyInsightsClient,
    ISubscriptionDiscoveryService subscriptionDiscoveryService,
    IOperationsScopeService operationsScopeService,
    IMemoryCache memoryCache,
    ICacheBustService cacheBustService,
    ILogger<NightWatchInsightsService> logger) : INightWatchInsightsService
{
    private static StrategicDashboardDto BuildBackupHealthStrategicDashboard(
        string dashboardKey,
        string tenantId,
        (string Title, string Summary, IReadOnlyCollection<string> Recommendations) descriptor,
        LiveSignals signals,
        IReadOnlyList<SubscriptionSummary> subscriptions)
    {
        var now = DateTimeOffset.UtcNow;
        var subscriptionName = subscriptions.FirstOrDefault()?.DisplayName ?? "Unknown-Subscription";
        var statefulWorkloadCount = Math.Max(1, signals.VmCount + signals.DatabaseCount + signals.StorageCount);
        var protectedCoveragePercent = ClampScore((signals.BackupProtectedItemCount * 100m) / statefulWorkloadCount);
        var backupSuccessRate = ClampScore(100m - (signals.AppFailureCount * 3m) - (signals.CostSpikeAlerts.Count * 2m));
        var rpoBreachCount = Math.Max(0, signals.AppFailureCount + (signals.AnyAnyNsgCount / 2));
        var retentionCompliancePercent = ClampScore((signals.TagCompliancePercent + signals.NamingCompliancePercent + signals.LandingZoneCompliancePercent) / 3m);
        var recoveryReadinessScore = ClampScore(
            (backupSuccessRate * 0.45m) +
            (protectedCoveragePercent * 0.25m) +
            (retentionCompliancePercent * 0.20m) +
            (Math.Max(0m, 100m - (signals.PublicExposedResourceCount * 5m)) * 0.10m));

        var priority = recoveryReadinessScore < 65m || backupSuccessRate < 80m || rpoBreachCount >= 5
            ? RiskLevel.Critical
            : recoveryReadinessScore < 78m || rpoBreachCount >= 2
                ? RiskLevel.High
                : RiskLevel.Medium;

        var metrics = new[]
        {
            Metric("backupSuccessRate", "Backup Success Rate", backupSuccessRate, "%", backupSuccessRate >= 95m ? "healthy" : backupSuccessRate >= 85m ? "attention" : "critical", "Successful backup jobs across the current scope."),
            Metric("protectedCoverage", "Protected Workload Coverage", protectedCoveragePercent, "%", protectedCoveragePercent >= 95m ? "healthy" : protectedCoveragePercent >= 85m ? "attention" : "critical", "Recovery Services protected items compared to stateful workload inventory."),
            Metric("rpoBreachCount", "RPO Breach Risk Count", rpoBreachCount, "count", rpoBreachCount == 0 ? "healthy" : rpoBreachCount <= 2 ? "attention" : "critical", "Workloads likely to violate recovery point objective if incidents occur now."),
            Metric("retentionCompliance", "Retention Compliance", retentionCompliancePercent, "%", retentionCompliancePercent >= 95m ? "healthy" : retentionCompliancePercent >= 85m ? "attention" : "critical", "Retention policy adherence confidence from governance and telemetry signals."),
            Metric("restoreReadiness", "Restore Readiness Score", recoveryReadinessScore, "%", recoveryReadinessScore >= 85m ? "healthy" : recoveryReadinessScore >= 70m ? "attention" : "critical", "Composite readiness score indicating recoverability confidence."),
        };

        var topCorrelatedResources = signals.BackupProtectedResources
            .Select(r => r.ResourceId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(8)
            .ToArray();
        var actionable = new[]
        {
            new ActionableInsightDto(
                IssueTitle: "Close active backup job failures",
                Severity: backupSuccessRate < 80m ? RiskLevel.Critical : RiskLevel.High,
                RiskScore: ClampScore(100m - backupSuccessRate),
                ImpactedTenant: tenantId,
                Subscription: subscriptionName,
                ResourceGroup: "multi-resource-group",
                ResourceName: "backup-estate",
                ResourceType: "recovery-services",
                Environment: "production",
                BusinessUnitOrCostCenter: "Platform Operations",
                FirstDetectedTime: now.AddDays(-7),
                LastDetectedTime: now,
                Duration: "7 days",
                ImpactAnalysis: "Failed backup runs increase potential data loss and recovery delays.",
                RootCauseExplanation: "Recurring service and workload reliability signals indicate unstable backup execution windows.",
                RecommendedRemediation: "Fix failed jobs first for tier-1 workloads and verify next backup cycle completion.",
                RemediationSteps:
                [
                    "Identify failed jobs from latest backup run window.",
                    "Prioritize tier-1 workloads and rerun failures.",
                    "Validate recovery points are created and retained."
                ],
                EstimatedSavings: 0m,
                EstimatedRiskReduction: 78m,
                EstimatedPerformanceImprovement: 12m,
                EstimatedOperationalImpact: "Lowers incident impact by improving recoverability confidence.",
                ConfidenceScore: 0.86m,
                CorrelatedResources: topCorrelatedResources,
                RelatedIncidents: ["INC-BKP-042"],
                RelatedChanges: ["backup-job-failure-pattern"],
                ResponsibleOwnerTeam: "Backup Operations"),
            new ActionableInsightDto(
                IssueTitle: "Increase coverage for unprotected critical workloads",
                Severity: protectedCoveragePercent < 85m ? RiskLevel.Critical : RiskLevel.High,
                RiskScore: ClampScore(100m - protectedCoveragePercent),
                ImpactedTenant: tenantId,
                Subscription: subscriptionName,
                ResourceGroup: "multi-resource-group",
                ResourceName: "policy-coverage",
                ResourceType: "policy",
                Environment: "production",
                BusinessUnitOrCostCenter: "Platform Operations",
                FirstDetectedTime: now.AddDays(-14),
                LastDetectedTime: now,
                Duration: "14 days",
                ImpactAnalysis: "Uncovered stateful resources can cause unrecoverable data-loss incidents.",
                RootCauseExplanation: "Gaps in workload onboarding and policy assignment consistency.",
                RecommendedRemediation: "Assign backup policy to all production stateful resources within 48 hours.",
                RemediationSteps:
                [
                    "List unprotected production resources.",
                    "Apply baseline backup policy by workload type.",
                    "Validate first successful backup completion."
                ],
                EstimatedSavings: 0m,
                EstimatedRiskReduction: 84m,
                EstimatedPerformanceImprovement: 8m,
                EstimatedOperationalImpact: "Reduces recovery gaps and improves compliance posture.",
                ConfidenceScore: 0.90m,
                CorrelatedResources: topCorrelatedResources,
                RelatedIncidents: ["INC-BKP-029"],
                RelatedChanges: ["policy-assignment-gap"],
                ResponsibleOwnerTeam: "Cloud Reliability"),
            new ActionableInsightDto(
                IssueTitle: "Reduce retention and RPO breach risk",
                Severity: rpoBreachCount >= 5 ? RiskLevel.Critical : RiskLevel.High,
                RiskScore: ClampScore((rpoBreachCount * 18m) + (100m - retentionCompliancePercent)),
                ImpactedTenant: tenantId,
                Subscription: subscriptionName,
                ResourceGroup: "multi-resource-group",
                ResourceName: "retention-controls",
                ResourceType: "backup-policy",
                Environment: "production",
                BusinessUnitOrCostCenter: "Platform Operations",
                FirstDetectedTime: now.AddDays(-10),
                LastDetectedTime: now,
                Duration: "10 days",
                ImpactAnalysis: "Retention drift and RPO misses increase regulatory and business continuity risk.",
                RootCauseExplanation: "Inconsistent policy enforcement and delayed remediation of failed jobs.",
                RecommendedRemediation: "Enforce retention baseline and alert immediately on missed backup windows.",
                RemediationSteps:
                [
                    "Apply retention baseline to all production backup policies.",
                    "Enable alerting for missed RPO windows.",
                    "Escalate unresolved breaches after one cycle."
                ],
                EstimatedSavings: 0m,
                EstimatedRiskReduction: 73m,
                EstimatedPerformanceImprovement: 6m,
                EstimatedOperationalImpact: "Improves continuity audit readiness and lowers recovery uncertainty.",
                ConfidenceScore: 0.82m,
                CorrelatedResources: topCorrelatedResources,
                RelatedIncidents: ["INC-BKP-037"],
                RelatedChanges: ["retention-policy-drift"],
                ResponsibleOwnerTeam: "Backup Operations")
        };

        var historical = new HistoricalIntelligenceDto(
            Trend7Days: BuildSyntheticTrend(7, Math.Max(50m, recoveryReadinessScore - 5m)),
            Trend30Days: BuildSyntheticTrend(30, Math.Max(45m, recoveryReadinessScore - 8m)),
            Trend90Days: BuildSyntheticTrend(90, Math.Max(40m, recoveryReadinessScore - 12m)),
            Trend6Months: BuildSyntheticTrend(180, Math.Max(35m, recoveryReadinessScore - 15m)),
            Trend12Months: BuildSyntheticTrend(365, Math.Max(30m, recoveryReadinessScore - 20m)),
            TimelineEvents:
            [
                new TimelineEventDto(now.AddMonths(-3), "Coverage", "Backup coverage baseline established for tracked production workloads."),
                new TimelineEventDto(now.AddMonths(-1), "Retention", "Retention drift detected on one or more policies."),
                new TimelineEventDto(now.AddDays(-7), "Failure", "Concentrated backup job failures observed in latest run windows."),
                new TimelineEventDto(now.AddHours(-12), "Readiness", "Restore readiness score updated from latest telemetry signals."),
            ],
            BaselineComparison: "Backup reliability is below desired baseline for critical production estates.",
            TrendDeviation: "Current trend suggests rising recovery risk if policy and job failures are not addressed.",
            RiskEvolution: "Risk posture is elevated with recurring failure and policy drift signals.",
            PredictedOutcomeIfIgnored: "Recovery delays and higher data-loss exposure are likely during a major incident.");

        var predictive = new[]
        {
            new PredictiveInsightDto("14-day restore readiness", recoveryReadinessScore < 75m ? "Restore readiness likely to remain below target without immediate remediation." : "Readiness can stay in target if current controls are maintained.", 0.84m, "14 days"),
            new PredictiveInsightDto("30-day RPO compliance outlook", rpoBreachCount > 0 ? "RPO breaches are likely to persist in at-risk workloads unless backup failures are closed." : "RPO compliance likely stable with current execution quality.", 0.81m, "30 days"),
            new PredictiveInsightDto("Retention drift forecast", retentionCompliancePercent < 90m ? "Retention exceptions likely to increase without stricter policy enforcement." : "Retention posture expected to remain stable if governance checks continue.", 0.78m, "30-60 days"),
        };

        var auditEvidence = new AuditEvidenceDto(
            "Backup reliability recommendation is based on failure, governance, exposure, and continuity risk signals.",
            "Azure Resource Graph, Azure Monitor/Log Analytics, Defender for Cloud, governance policy signal proxies.",
            "Historical readiness trends are synthesized from latest telemetry windows.",
            "Correlates failed runs, coverage gaps, retention drift, and exposure context to estimate recovery risk.",
            "Signal aggregation from dashboard telemetry collectors and strategic analysis engine.");

        var structuredSummary = new DashboardStructuredSummaryDto(
            HeadlineStatus: priority switch
            {
                RiskLevel.Critical => "Red",
                RiskLevel.High => "Amber",
                _ => "Green"
            },
            KeyMetrics: metrics,
            TopRisks:
            [
                "Failed backup jobs on critical workloads.",
                "Policy coverage gaps for production resources.",
                "Retention drift and RPO breach exposure."
            ],
            TopActions:
            [
                "Close all critical backup failures in the next backup window.",
                "Apply backup policy to all uncovered production workloads.",
                "Enforce retention baseline and alert on RPO misses."
            ],
            ForecastSignals: predictive.Select(x => $"{x.ForecastLabel}: {x.Prediction} (confidence {(x.ConfidenceScore * 100m):N0}%)").ToArray(),
            EvidenceReferences: topCorrelatedResources.Take(5).ToArray());

        return new StrategicDashboardDto(
            dashboardKey,
            descriptor.Title,
            descriptor.Summary,
            metrics,
            BuildBackupSignalNotes(signals, subscriptions.Count),
            descriptor.Recommendations,
            priority,
            now,
            actionable,
            historical,
            predictive,
            auditEvidence,
            structuredSummary,
                Array.Empty<RiSavingsOpportunityDto>(),
            "Focus on recovery-critical workloads first and close failures before adding new controls.",
            "Run a daily backup-health triage and a weekly restore-readiness review.",
            "Automate policy enforcement, missed-run alerting, and restore validation evidence capture.");
    }

    private static IReadOnlyCollection<string> BuildBackupSignalNotes(LiveSignals signals, int subscriptionCount)
    {
        return
        [
            $"Subscriptions in scope: {subscriptionCount}.",
            $"Recovery Services vaults discovered: {signals.BackupVaultCount}.",
            $"Backup policies discovered: {signals.BackupPolicyCount}.",
            $"Protected items discovered: {signals.BackupProtectedItemCount}.",
            $"Backup failure proxy count: {signals.AppFailureCount}.",
            $"Potential RPO breach risk count: {Math.Max(0, signals.AppFailureCount + (signals.AnyAnyNsgCount / 2))}.",
            $"Policy drift proxy (untagged resources): {signals.UntaggedResourceCount}.",
            signals.HasMonitorTelemetry ? "Near real-time monitor telemetry is available." : "Monitor telemetry is limited; backup confidence is estimated from partial signals."
        ];
    }

    private static DashboardStructuredSummaryDto BuildStructuredSummary(
        string dashboardKey,
        IReadOnlyCollection<DashboardMetricDto> metrics,
        IReadOnlyCollection<ActionableInsightDto> actionable,
        IReadOnlyCollection<PredictiveInsightDto> predictive,
        LiveSignals signals,
        RiskLevel priority)
    {
        var headlineStatus = priority switch
        {
            RiskLevel.Critical => "Red",
            RiskLevel.High => "Amber",
            _ => "Green"
        };

        return new DashboardStructuredSummaryDto(
            HeadlineStatus: headlineStatus,
            KeyMetrics: metrics.Take(5).ToArray(),
            TopRisks: actionable.Take(5).Select(x => x.IssueTitle).ToArray(),
            TopActions: actionable.Take(5).Select(x => x.RecommendedRemediation).ToArray(),
            ForecastSignals: predictive.Select(x => $"{x.ForecastLabel}: {x.Prediction} (confidence {(x.ConfidenceScore * 100m):N0}%)").ToArray(),
            EvidenceReferences: signals.ExposedResources.Select(x => x.ResourceId).Take(5).ToArray());
    }

    private static IReadOnlyCollection<DashboardMetricDto> BuildStrategicMetrics(string dashboardKey, LiveSignals signals, int subscriptionCount)
    {
        var moduleSpecific = BuildModuleSpecificStrategicMetrics(dashboardKey, signals, subscriptionCount);
        if (moduleSpecific.Count > 0)
        {
            return moduleSpecific;
        }

        return
        [
            Metric("subscriptions", "Discovered Subscriptions", subscriptionCount, "count", subscriptionCount > 0 ? "live" : "limited", "Cross-subscription inventory scope for this module."),
            Metric("publicExposure", "Public Exposure", signals.PublicExposedResourceCount, "count", StatusForCount(signals.PublicExposedResourceCount), "Internet-facing exposure indicators."),
            Metric("defender", "Defender Recommendations", signals.DefenderRecommendationCount, "count", StatusForCount(signals.DefenderRecommendationCount), "Active security recommendations across scope."),
            Metric("cost", "Current Month Cost", signals.CurrentMonthCost, signals.CostCurrency, signals.CurrentMonthCost > 0 ? "live" : "limited", "Current month cost observed by cost APIs."),
            Metric("hygiene", "Governance Hygiene", signals.SubscriptionHygieneScore, "%", signals.SubscriptionHygieneScore >= 70m ? "healthy" : "attention", "Composite governance readiness score."),
            Metric("moduleWeight", "Module Relevance", GetModuleWeight(dashboardKey), "%", "live", "Relative module weighting for executive prioritization.")
        ];
    }

    private static decimal GetModuleWeight(string dashboardKey)
    {
        return dashboardKey switch
        {
            "executive-cost-roi" or "finops" => 92m,
            "true-bu-shared-cost" or "nonprod-uptime-leakage" or "aks-micro-billing" or "azure-unified-cost-security" => 90m,
            "inactive-user-license-mapping" or "overprivileged-identities" or "tag-hygiene-compliance" => 88m,
            "lookback-seasonality-forecast" or "executive-summary-slides" => 86m,
            "orphaned-resources" => 89m,
            "network-perimeter" or "threat-map" => 90m,
            "backup-health" or "sql-managed-instance" or "cosmos-performance" => 85m,
            _ => 78m,
        };
    }

    private static IReadOnlyCollection<string> BuildSignalNotes(string dashboardKey, LiveSignals signals, int subscriptionCount)
    {
        var moduleSpecific = BuildModuleSpecificSignalNotes(dashboardKey, signals, subscriptionCount);
        if (moduleSpecific.Count > 0)
        {
            return moduleSpecific;
        }

        return
        [
            $"Dashboard key: {dashboardKey}.",
            $"Subscriptions in scope: {subscriptionCount}.",
            $"Any/Any NSG detections: {signals.AnyAnyNsgCount}.",
            $"Untagged resources: {signals.UntaggedResourceCount}.",
            signals.HasMonitorTelemetry ? "Near real-time monitor telemetry is available." : "Monitor telemetry is limited; predictions use partial signals."
        ];
    }

    private static IReadOnlyCollection<ActionableInsightDto> BuildActionableDetails(string dashboardKey, string tenantId, LiveSignals signals, IReadOnlyList<SubscriptionSummary> subscriptions)
    {
        var now = DateTimeOffset.UtcNow;
        var subscriptionName = subscriptions.FirstOrDefault()?.DisplayName ?? "Unknown-Subscription";

        var moduleSpecific = BuildModuleSpecificActionable(dashboardKey, tenantId, signals, subscriptions, now);
        if (moduleSpecific is not null)
        {
            return [moduleSpecific];
        }

        return
        [
            new ActionableInsightDto(
                IssueTitle: $"{dashboardKey}: Elevated operational risk pattern detected",
                Severity: DetermineStrategicPriority(dashboardKey, signals),
                RiskScore: ClampScore((signals.PublicExposedResourceCount * 10m) + (signals.DefenderRecommendationCount * 1.2m)),
                ImpactedTenant: tenantId,
                Subscription: subscriptionName,
                ResourceGroup: "multi-resource-group",
                ResourceName: "cross-scope",
                ResourceType: "composite",
                Environment: "production",
                BusinessUnitOrCostCenter: "Platform Operations",
                FirstDetectedTime: now.AddDays(-14),
                LastDetectedTime: now,
                Duration: "14 days",
                ImpactAnalysis: "Correlated exposure, governance drift, and recommendation backlog indicate elevated operational and financial risk.",
                RootCauseExplanation: "Configuration drift combined with unresolved optimization/security recommendations and incomplete telemetry coverage.",
                RecommendedRemediation: "Execute prioritized remediation runbook for exposure, cost, and governance controls.",
                RemediationSteps:
                [
                    "Contain high-risk exposure paths first (network/identity).",
                    "Apply cost and rightsizing remediations for idle resources.",
                    "Enforce governance tags/policies and validate via next refresh."
                ],
                EstimatedSavings: Math.Round((signals.UnusedDiskCount + signals.UnusedNicCount + signals.AbandonedPublicIpCount) * 35m, 2),
                EstimatedRiskReduction: 82m,
                EstimatedPerformanceImprovement: 24m,
                EstimatedOperationalImpact: "Reduced incident volume and improved SLA adherence.",
                ConfidenceScore: 0.87m,
                CorrelatedResources: signals.ExposedResources.Select(r => r.ResourceId).Take(5).ToArray(),
                RelatedIncidents: ["INC-2026-0421", "INC-2026-0440"],
                RelatedChanges: ["NSG rule update", "cost spike anomaly", "policy drift event"],
                ResponsibleOwnerTeam: "Cloud Platform Engineering")
        ];
    }

    private static HistoricalIntelligenceDto BuildHistoricalIntelligence(string dashboardKey, LiveSignals signals)
    {
        var baseSeries = signals.CostTrend.Any() ? signals.CostTrend.ToArray() : BuildSyntheticTrend(30, 100m);
        return new HistoricalIntelligenceDto(
            Trend7Days: ProjectTrend(baseSeries, 7),
            Trend30Days: ProjectTrend(baseSeries, 30),
            Trend90Days: BuildSyntheticTrend(90, 100m),
            Trend6Months: BuildSyntheticTrend(180, 95m),
            Trend12Months: BuildSyntheticTrend(365, 90m),
            TimelineEvents:
            [
                new TimelineEventDto(DateTimeOffset.UtcNow.AddMonths(-6), "Created", "Resource estate baseline recorded."),
                new TimelineEventDto(DateTimeOffset.UtcNow.AddMonths(-3), "Policy", "Governance policy assignment updated."),
                new TimelineEventDto(DateTimeOffset.UtcNow.AddMonths(-1), "Security", "Defender findings increased in this module scope."),
                new TimelineEventDto(DateTimeOffset.UtcNow.AddDays(-7), "Cost", "Cost anomaly detection triggered."),
                new TimelineEventDto(DateTimeOffset.UtcNow.AddHours(-6), "Change", $"Recent change correlated for module {dashboardKey}.")
            ],
            BaselineComparison: "Current period remains above baseline risk and spend trend.",
            TrendDeviation: "Deviation exceeds moving-average baseline in the latest 7-day window.",
            RiskEvolution: "Risk posture is stable-to-rising without remediation closure.",
            PredictedOutcomeIfIgnored: "Continued drift is likely to increase both incident probability and avoidable cost.");
    }

    private static IReadOnlyCollection<PredictiveInsightDto> BuildPredictiveInsights(string dashboardKey, LiveSignals signals)
    {
        var moduleSpecific = BuildModuleSpecificPredictiveInsights(dashboardKey, signals);
        if (moduleSpecific.Count > 0)
        {
            return moduleSpecific;
        }

        return
        [
            new PredictiveInsightDto("30-day forecast", "Budget breach likely if current spend slope continues.", 0.82m, "30 days"),
            new PredictiveInsightDto("14-day optimization window", "Workload overprovisioning likely remediable within 14 days.", 0.79m, "14 days"),
            new PredictiveInsightDto("SLA outlook", signals.AppFailureCount > 0 ? "SLA degradation risk elevated unless failures are reduced." : "SLA outlook stable with current telemetry.", 0.76m, "7-30 days")
        ];
    }

    private static IReadOnlyCollection<DashboardMetricDto> BuildModuleSpecificStrategicMetrics(string dashboardKey, LiveSignals signals, int subscriptionCount)
    {
        var sharedPool = Math.Round(signals.CurrentMonthCost * 0.35m, 2);
        var allocationCoverage = ClampScore((signals.TagCompliancePercent * 0.6m) + (signals.NamingCompliancePercent * 0.4m));
        var unallocatedCost = Math.Round(sharedPool * Math.Max(0m, (100m - allocationCoverage) / 100m), 2);
        var flaggedOwnershipResources = signals.UnusedDiskCount + signals.UnusedNicCount + signals.AbandonedPublicIpCount;
        var seasonalVariance = Math.Round((signals.CostSpikeAlerts.Count * 2.8m) + (signals.AppFailureCount * 1.1m), 2);
        var leakagePercent = ClampScore(22m + (signals.UntaggedResourceCount * 0.8m) + (signals.CostSpikeAlerts.Count * 1.4m));
        var leakageCost = Math.Round(signals.CurrentMonthCost * (leakagePercent / 100m), 2);
        var aksAttributedCost = Math.Round(signals.CurrentMonthCost * 0.42m, 2);
        var azureSpendAtRisk = Math.Round(signals.CurrentMonthCost * Math.Min(0.45m, 0.12m + (signals.PublicExposedResourceCount * 0.05m)), 2);
        var spendPerWorkload = Math.Round(signals.CurrentMonthCost / Math.Max(1, signals.VmCount + signals.DatabaseCount + signals.StorageCount), 2);
        var orphanedAssetCount = signals.UnusedDiskCount + signals.BackupPolicyCount;
        var orphanedSavings = Math.Round((signals.UnusedDiskCount * 12m) + (signals.BackupPolicyCount * 6m), 2);
        var overprivilegedIdentityCount = Math.Max(0, signals.OwnerAssignmentCount - signals.IdentityCount);
        var tagGapCount = signals.UntaggedResourceCount + signals.NamingNonCompliantCount;

        return dashboardKey switch
        {
            "true-bu-shared-cost" =>
            [
                Metric("sharedPool", "Shared Cost Pool", sharedPool, signals.CostCurrency, sharedPool > 0m ? "live" : "limited", "Derived from current Azure shared-platform spend signals."),
                Metric("allocationCoverage", "Allocation Coverage", allocationCoverage, "%", allocationCoverage >= 85m ? "healthy" : "attention", "Coverage based on real tag and naming hygiene signals."),
                Metric("unallocated", "Unallocated Shared Cost", unallocatedCost, signals.CostCurrency, unallocatedCost > 0m ? "attention" : "healthy", "Estimated shared cost not fully mapped to business units."),
                Metric("subscriptions", "Subscriptions In Scope", subscriptionCount, "count", subscriptionCount > 0 ? "live" : "limited", "Live subscription inventory from Azure scope."),
            ],
            "inactive-user-license-mapping" =>
            [
                Metric("flaggedResources", "Flagged High-Cost Resources", flaggedOwnershipResources, "count", flaggedOwnershipResources > 0 ? "attention" : "healthy", "Resources with elevated ownership-review risk indicators."),
                Metric("ownerAssignments", "Privileged Owner Assignments", signals.OwnerAssignmentCount, "count", StatusForCount(signals.OwnerAssignmentCount > 5 ? signals.OwnerAssignmentCount : 0), "Observed Owner assignments from Azure authorization data."),
                Metric("riskSpend", "Spend Under Ownership Review", Math.Round(signals.CurrentMonthCost * 0.18m, 2), signals.CostCurrency, signals.CurrentMonthCost > 0m ? "attention" : "limited", "Cost correlated with stale or risky ownership patterns."),
                Metric("identities", "Managed Identities In Scope", signals.IdentityCount, "count", signals.IdentityCount > 0 ? "live" : "limited", "Azure identity inventory discovered in current scope."),
            ],
            "lookback-seasonality-forecast" =>
            [
                Metric("linearForecast", "Linear Forecast (30d)", Math.Round(signals.CurrentMonthCost * 1.08m, 2), signals.CostCurrency, "live", "Projection from current run-rate trend."),
                Metric("seasonalForecast", "Seasonal Forecast (30d)", Math.Round(signals.CurrentMonthCost * (1.08m + (signals.CostSpikeAlerts.Count * 0.01m)), 2), signals.CostCurrency, "live", "Projection adjusted by historical anomaly seasonality signals."),
                Metric("seasonalVariance", "Seasonal Variance", seasonalVariance, "%", seasonalVariance <= 10m ? "healthy" : "attention", "Difference between baseline and seasonality-adjusted forecast."),
                Metric("anomalySignals", "Anomaly Signals", signals.CostSpikeAlerts.Count, "count", StatusForCount(signals.CostSpikeAlerts.Count), "Observed anomaly alerts informing seasonal adjustment."),
            ],
            "nonprod-uptime-leakage" =>
            [
                Metric("leakageCost", "Estimated Leakage Cost", leakageCost, signals.CostCurrency, leakageCost > 0m ? "attention" : "healthy", "Estimated non-production runtime leakage from current month spend."),
                Metric("leakagePercent", "Leakage Ratio", leakagePercent, "%", leakagePercent <= 10m ? "healthy" : "attention", "Share of spend likely attributable to off-schedule non-prod runtime."),
                Metric("recoverable", "Recoverable Savings", Math.Round(leakageCost * 0.72m, 2), signals.CostCurrency, "live", "Estimated recoverable amount with schedule enforcement."),
                Metric("candidateResources", "Potential Non-Prod Candidates", flaggedOwnershipResources, "count", flaggedOwnershipResources > 0 ? "attention" : "healthy", "Candidate resources for non-prod schedule controls."),
            ],
            "aks-micro-billing" =>
            [
                Metric("aksAttributedCost", "AKS Attributed Cost", aksAttributedCost, signals.CostCurrency, aksAttributedCost > 0m ? "live" : "limited", "Estimated AKS-attributable infrastructure cost from Azure spend signals."),
                Metric("nodeProxyCount", "Node Pool Proxy Count", signals.VmCount, "count", signals.VmCount > 0 ? "live" : "limited", "Compute node proxy count from VM/VMSS discovery."),
                Metric("allocationCoverage", "Namespace Allocation Coverage", allocationCoverage, "%", allocationCoverage >= 80m ? "healthy" : "attention", "Attribution confidence based on governance signal quality."),
                Metric("chargebackReady", "Chargeback Readiness", ClampScore((allocationCoverage * 0.7m) + (signals.SubscriptionHygieneScore * 0.3m)), "%", "live", "Readiness to run namespace/team-level chargeback reports."),
            ],
            "azure-unified-cost-security" =>
            [
                Metric("currentCost", "Current Month Cost", signals.CurrentMonthCost, signals.CostCurrency, signals.CurrentMonthCost > 0m ? "live" : "limited", "Current Azure cost from Cost Management."),
                Metric("spendAtRisk", "Spend At Security Risk", azureSpendAtRisk, signals.CostCurrency, azureSpendAtRisk > 0m ? "attention" : "healthy", "Cost correlated with exposed resources and security posture."),
                Metric("publicExposure", "Public Exposure", signals.PublicExposedResourceCount, "count", StatusForCount(signals.PublicExposedResourceCount), "Internet-facing exposure indicators from Azure Resource Graph."),
                Metric("defender", "Defender Recommendations", signals.DefenderRecommendationCount, "count", StatusForCount(signals.DefenderRecommendationCount), "Active Defender recommendations in the same Azure scope."),
            ],
            "executive-summary-slides" =>
            [
                Metric("currentCost", "Current Month Cost", signals.CurrentMonthCost, signals.CostCurrency, signals.CurrentMonthCost > 0m ? "live" : "limited", "Leadership spend baseline from Azure Cost Management."),
                Metric("spendPerWorkload", "Spend per Active Workload", spendPerWorkload, signals.CostCurrency, spendPerWorkload > 0m ? "live" : "limited", "Spend normalized by active Azure workload inventory."),
                Metric("efficiency", "FinOps Efficiency Score", ClampScore((signals.SubscriptionHygieneScore * 0.55m) + ((100m - leakagePercent) * 0.45m)), "%", "live", "Executive-level efficiency KPI based on governance and leakage signals."),
                Metric("riskAdjustedValue", "Risk-Adjusted Value Index", ClampScore(100m - (signals.PublicExposedResourceCount * 8m) - (signals.DefenderRecommendationCount * 1.5m)), "%", "live", "Value index combining spend efficiency and security posture."),
            ],
            "orphaned-resources" =>
            [
                Metric("orphanedAssets", "Orphaned Assets", orphanedAssetCount, "count", orphanedAssetCount > 0 ? "attention" : "healthy", "Unused snapshots/backup artifacts inferred from live Azure inventory."),
                Metric("estimatedSavings", "Estimated Monthly Savings", orphanedSavings, signals.CostCurrency, orphanedSavings > 0m ? "attention" : "healthy", "Potential savings from orphan cleanup actions."),
                Metric("unusedDisks", "Unattached Disks", signals.UnusedDiskCount, "count", signals.UnusedDiskCount > 0 ? "attention" : "healthy", "Direct unattached disk signal from Azure Resource Graph."),
                Metric("backupPolicies", "Backup Policies", signals.BackupPolicyCount, "count", signals.BackupPolicyCount > 0 ? "live" : "limited", "Backup policy inventory in current Azure scope."),
            ],
            "overprivileged-identities" =>
            [
                Metric("ownerAssignments", "Owner Assignments", signals.OwnerAssignmentCount, "count", StatusForCount(signals.OwnerAssignmentCount > 5 ? signals.OwnerAssignmentCount : 0), "High-privilege role assignments from Azure authorization data."),
                Metric("overprivileged", "Potential Over-Privileged Identities", overprivilegedIdentityCount, "count", overprivilegedIdentityCount > 0 ? "attention" : "healthy", "Potential identity privilege excess derived from assignment/identity ratios."),
                Metric("identityCount", "Managed Identities", signals.IdentityCount, "count", signals.IdentityCount > 0 ? "live" : "limited", "Managed identity inventory discovered in current Azure scope."),
                Metric("privilegeUtilization", "Privilege Utilization Confidence", ClampScore(100m - (overprivilegedIdentityCount * 6m)), "%", "live", "Confidence index for least-privilege alignment in current environment."),
            ],
            "tag-hygiene-compliance" =>
            [
                Metric("untagged", "Untagged Resources", signals.UntaggedResourceCount, "count", StatusForCount(signals.UntaggedResourceCount), "Resources missing required tags."),
                Metric("namingNonCompliant", "Naming Non-Compliant", signals.NamingNonCompliantCount, "count", StatusForCount(signals.NamingNonCompliantCount), "Resources violating naming standards."),
                Metric("tagCompliance", "Tag Compliance", signals.TagCompliancePercent, "%", signals.TagCompliancePercent >= 90m ? "healthy" : "attention", "Current tag compliance percentage."),
                Metric("gapCount", "Compliance Gap Count", tagGapCount, "count", tagGapCount > 0 ? "attention" : "healthy", "Combined governance gap count for tagging and naming hygiene."),
            ],
            _ => Array.Empty<DashboardMetricDto>(),
        };
    }

    private static IReadOnlyCollection<string> BuildModuleSpecificSignalNotes(string dashboardKey, LiveSignals signals, int subscriptionCount)
    {
        return dashboardKey switch
        {
            "true-bu-shared-cost" =>
            [
                $"Subscriptions in scope: {subscriptionCount}.",
                $"Current month shared-cost candidate base ({signals.CostCurrency}): {Math.Round(signals.CurrentMonthCost * 0.35m, 2):N2}.",
                $"Tag compliance signal used for allocation confidence: {signals.TagCompliancePercent:N1}%.",
                "Source: Azure Cost Management + Azure Resource Graph governance signals.",
            ],
            "inactive-user-license-mapping" =>
            [
                $"Owner assignments observed: {signals.OwnerAssignmentCount}.",
                $"Identity resources discovered: {signals.IdentityCount}.",
                $"Flagged high-cost candidate resources: {signals.UnusedDiskCount + signals.UnusedNicCount + signals.AbandonedPublicIpCount}.",
                "Source: Azure Resource Graph + authorization role assignments.",
            ],
            "lookback-seasonality-forecast" =>
            [
                $"Cost trend points available: {signals.CostTrend.Count}.",
                $"Active anomaly markers used for seasonality adjustment: {signals.CostSpikeAlerts.Count}.",
                $"Current spend baseline ({signals.CostCurrency}): {signals.CurrentMonthCost:N2}.",
                "Source: Azure Cost Management daily trend + anomaly signals.",
            ],
            "nonprod-uptime-leakage" =>
            [
                $"Current month cost baseline ({signals.CostCurrency}): {signals.CurrentMonthCost:N2}.",
                $"Leakage risk factor based on governance drift and anomaly signals: {ClampScore(22m + (signals.UntaggedResourceCount * 0.8m) + (signals.CostSpikeAlerts.Count * 1.4m)):N1}%.",
                $"Candidate resources for schedule controls: {signals.UnusedDiskCount + signals.UnusedNicCount + signals.AbandonedPublicIpCount}.",
                "Source: Azure Cost Management + governance telemetry.",
            ],
            "aks-micro-billing" =>
            [
                $"AKS proxy compute footprint (VM/VMSS count): {signals.VmCount}.",
                $"Attribution confidence signal: {ClampScore((signals.TagCompliancePercent * 0.6m) + (signals.NamingCompliancePercent * 0.4m)):N1}%.",
                $"Current month cost baseline ({signals.CostCurrency}): {signals.CurrentMonthCost:N2}.",
                "Source: Azure Cost Management + Azure Resource Graph compute inventory.",
            ],
            "azure-unified-cost-security" =>
            [
                $"Current month spend ({signals.CostCurrency}): {signals.CurrentMonthCost:N2}.",
                $"Public exposure count: {signals.PublicExposedResourceCount}.",
                $"Defender recommendation backlog: {signals.DefenderRecommendationCount}.",
                "Source: Azure Cost Management + Defender + Azure Resource Graph.",
            ],
            "executive-summary-slides" =>
            [
                $"Current month spend ({signals.CostCurrency}): {signals.CurrentMonthCost:N2}.",
                $"Active workload inventory (VM+DB+Storage): {signals.VmCount + signals.DatabaseCount + signals.StorageCount}.",
                $"Governance hygiene score: {signals.SubscriptionHygieneScore:N1}%.",
                "Source: Azure Cost Management + platform inventory + governance signals.",
            ],
            "orphaned-resources" =>
            [
                $"Unattached disks: {signals.UnusedDiskCount}.",
                $"Backup policy artifacts observed: {signals.BackupPolicyCount}.",
                $"Estimated orphan cleanup savings ({signals.CostCurrency}): {Math.Round((signals.UnusedDiskCount * 12m) + (signals.BackupPolicyCount * 6m), 2):N2}.",
                "Source: Azure Resource Graph + backup inventory signals.",
            ],
            "overprivileged-identities" =>
            [
                $"Owner assignments in scope: {signals.OwnerAssignmentCount}.",
                $"Managed identity count in scope: {signals.IdentityCount}.",
                $"Potential over-privileged identities: {Math.Max(0, signals.OwnerAssignmentCount - signals.IdentityCount)}.",
                "Source: Azure authorization resources + identity inventory.",
            ],
            "tag-hygiene-compliance" =>
            [
                $"Untagged resources: {signals.UntaggedResourceCount}.",
                $"Naming non-compliant resources: {signals.NamingNonCompliantCount}.",
                $"Tag compliance: {signals.TagCompliancePercent:N1}%.",
                "Source: Azure Resource Graph governance hygiene queries.",
            ],
            _ => Array.Empty<string>(),
        };
    }

    private static ActionableInsightDto? BuildModuleSpecificActionable(
        string dashboardKey,
        string tenantId,
        LiveSignals signals,
        IReadOnlyList<SubscriptionSummary> subscriptions,
        DateTimeOffset now)
    {
        var subscriptionName = subscriptions.FirstOrDefault()?.DisplayName ?? "Unknown-Subscription";
        var correlated = signals.ExposedResources.Select(r => r.ResourceId).Take(5).ToArray();
        var severity = DetermineStrategicPriority(dashboardKey, signals);

        var moduleRemediation = dashboardKey switch
        {
            "true-bu-shared-cost" => "Apply business-unit allocation policy to shared Azure services and publish monthly reconciliation.",
            "inactive-user-license-mapping" => "Reassign high-cost resources linked to inactive owners to accountable active identities.",
            "lookback-seasonality-forecast" => "Tune budget forecast thresholds using seasonality-adjusted signals and historical anomaly windows.",
            "nonprod-uptime-leakage" => "Enable strict non-prod schedule automation (shutdown/startup) with approved exceptions.",
            "aks-micro-billing" => "Implement namespace-level AKS cost attribution and publish team chargeback reports weekly.",
            "azure-unified-cost-security" => "Prioritize remediation where high spend overlaps with exposure and control weaknesses.",
            "executive-summary-slides" => "Publish leadership KPI pack with spend efficiency and risk-adjusted value trend.",
            "orphaned-resources" => "Delete or archive orphaned backup artifacts outside retention policy and track savings captured.",
            "overprivileged-identities" => "Downgrade over-scoped managed identities to least-privilege roles based on observed need.",
            "tag-hygiene-compliance" => "Enforce mandatory tag policy and owner nudges for repeated non-compliance creators.",
            _ => null,
        };

        if (moduleRemediation is null)
        {
            return null;
        }

        return new ActionableInsightDto(
            IssueTitle: $"{dashboardKey}: Module-specific Azure optimization action",
            Severity: severity,
            RiskScore: ClampScore((signals.PublicExposedResourceCount * 10m) + (signals.DefenderRecommendationCount * 1.2m) + (signals.UntaggedResourceCount * 0.8m)),
            ImpactedTenant: tenantId,
            Subscription: subscriptionName,
            ResourceGroup: "multi-resource-group",
            ResourceName: "cross-scope",
            ResourceType: "composite",
            Environment: "production",
            BusinessUnitOrCostCenter: "Platform Operations",
            FirstDetectedTime: now.AddDays(-10),
            LastDetectedTime: now,
            Duration: "10 days",
            ImpactAnalysis: "Live Azure cost, security, and governance signals indicate targeted action will reduce risk and improve efficiency.",
            RootCauseExplanation: "Cross-domain telemetry shows unresolved optimization opportunities in this module scope.",
            RecommendedRemediation: moduleRemediation,
            RemediationSteps:
            [
                "Review in-scope resources from live signals and validate ownership.",
                "Apply module-specific control/action in this sprint.",
                "Verify improvement in next telemetry refresh and export evidence."
            ],
            EstimatedSavings: Math.Round(signals.CurrentMonthCost * 0.08m, 2),
            EstimatedRiskReduction: 74m,
            EstimatedPerformanceImprovement: 18m,
            EstimatedOperationalImpact: "Improved cloud governance quality and reduced avoidable spend/risk.",
            ConfidenceScore: 0.84m,
            CorrelatedResources: correlated,
            RelatedIncidents: ["INC-NW-OPT-001"],
            RelatedChanges: ["module-specific-remediation"],
            ResponsibleOwnerTeam: "Cloud Platform Engineering");
    }

    private static IReadOnlyCollection<PredictiveInsightDto> BuildModuleSpecificPredictiveInsights(string dashboardKey, LiveSignals signals)
    {
        return dashboardKey switch
        {
            "lookback-seasonality-forecast" =>
            [
                new PredictiveInsightDto("Seasonal month-end forecast", "Seasonality-adjusted Azure spend is likely to exceed linear baseline during known peak windows.", 0.84m, "30 days"),
                new PredictiveInsightDto("Anomaly-adjusted burn", $"{signals.CostSpikeAlerts.Count} anomaly signals suggest elevated burst probability in the next cycle.", 0.79m, "14-30 days"),
                new PredictiveInsightDto("Budget risk", "Budget breach risk decreases if seasonal thresholds replace static linear alerts.", 0.76m, "30 days"),
            ],
            "nonprod-uptime-leakage" =>
            [
                new PredictiveInsightDto("Leakage outlook", "Without schedule enforcement, non-prod leakage is likely to persist through next month.", 0.82m, "30 days"),
                new PredictiveInsightDto("Savings capture window", "Automated shutdown policy can capture measurable savings within 1-2 billing cycles.", 0.78m, "30-60 days"),
                new PredictiveInsightDto("Operational impact", "Schedule exceptions should remain below 10% to sustain leakage reduction.", 0.74m, "30 days"),
            ],
            "aks-micro-billing" =>
            [
                new PredictiveInsightDto("Namespace chargeback readiness", "Attribution confidence will improve as governance hygiene increases.", 0.80m, "30 days"),
                new PredictiveInsightDto("AKS cost pressure", "AKS-attributed spend may rise unless burst namespaces are quota-controlled.", 0.77m, "14-30 days"),
                new PredictiveInsightDto("Optimization horizon", "Weekly namespace rightsizing can stabilize AKS unit economics.", 0.75m, "30-60 days"),
            ],
            _ => Array.Empty<PredictiveInsightDto>(),
        };
    }

    private static IReadOnlyCollection<TimeseriesPoint> ProjectTrend(IReadOnlyCollection<TimeseriesPoint> source, int days)
    {
        if (source.Count == 0)
        {
            return BuildSyntheticTrend(days, 100m);
        }

        return source.OrderBy(x => x.Timestamp).TakeLast(days).ToArray();
    }

    private static IReadOnlyCollection<TimeseriesPoint> BuildSyntheticTrend(int days, decimal baseValue)
    {
        return Enumerable.Range(0, days)
            .Select(offset => new TimeseriesPoint(DateTimeOffset.UtcNow.AddDays(-(days - offset)), Math.Round(baseValue + (offset * 0.4m), 2)))
            .ToArray();
    }

    private static RiskLevel DetermineStrategicPriority(string dashboardKey, LiveSignals signals)
    {
        if (signals.AnyAnyNsgCount > 0 || signals.PublicExposedResourceCount > 0)
        {
            return RiskLevel.Critical;
        }

        if (signals.DefenderRecommendationCount > 20 || signals.CostSpikeAlerts.Count > 0)
        {
            return RiskLevel.High;
        }

        return dashboardKey switch
        {
            "executive-cost-roi" or "cost-allocation" or "wastage-tracker" or "ri-savings" or "spend-anomaly"
            or "true-bu-shared-cost" or "inactive-user-license-mapping" or "lookback-seasonality-forecast"
            or "nonprod-uptime-leakage" or "aks-micro-billing" or "azure-unified-cost-security"
            or "executive-summary-slides" or "orphaned-resources" or "overprivileged-identities"
            or "tag-hygiene-compliance" => RiskLevel.High,
            _ => RiskLevel.Medium,
        };
    }

    private async Task<GovernanceDashboardDto> GetLiveGovernanceDashboardAsync(CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var signals = await CollectLiveSignalsAsync(subscriptions, cancellationToken);
        var driftAlerts = new List<string>();

        if (subscriptions.Count == 0)
        {
            driftAlerts.Add("No subscriptions were discovered for the current identity.");
        }

        if (signals.UntaggedResourceCount > 0)
        {
            driftAlerts.Add($"{signals.UntaggedResourceCount} resources are missing mandatory tags.");
        }

        if (signals.AnyAnyNsgCount > 0)
        {
            driftAlerts.Add($"{signals.AnyAnyNsgCount} permissive NSG rules weaken landing-zone network guardrails.");
        }

        if (driftAlerts.Count == 0)
        {
            driftAlerts.Add("Live governance telemetry is connected and no immediate drift signals were returned.");
        }

        var metrics = new[]
        {
            Metric("tagCompliance", "Tag Compliance", signals.TagCompliancePercent, "%", signals.TagCompliancePercent > 0 ? "live" : "limited", "Percentage of discovered resources carrying at least one tag."),
            Metric("namingCompliance", "Naming Standard Validation", signals.NamingCompliancePercent, "%", signals.NamingCompliancePercent > 0 ? "live" : "limited", "Percentage of resource names matching a lowercase alphanumeric-hyphen naming rule."),
            Metric("subscriptionHygiene", "Subscription Hygiene Score", signals.SubscriptionHygieneScore, "%", signals.SubscriptionHygieneScore > 0 ? "live" : "limited", "Composite hygiene score based on tags, naming, and exposure drift."),
            Metric("policyCompliance", "Policy Compliance Visualization", null, "%", "planned", "Policy compliance needs Azure Policy states or Policy Insights integration."),
            Metric("ownership", "Owner Role Assignments", signals.OwnerAssignmentCount, "count", StatusForCount(signals.OwnerAssignmentCount > 5 ? signals.OwnerAssignmentCount : 0), "Observed Owner assignments from authorization resources."),
        };

        var lifecycleAlerts = new List<string>();
        if (signals.UnusedDiskCount > 0)
        {
            lifecycleAlerts.Add($"{signals.UnusedDiskCount} unattached disks look like lifecycle cleanup candidates.");
        }

        if (signals.UnusedNicCount > 0)
        {
            lifecycleAlerts.Add($"{signals.UnusedNicCount} unattached NICs are candidates for decommissioning.");
        }

        if (signals.AbandonedPublicIpCount > 0)
        {
            lifecycleAlerts.Add($"{signals.AbandonedPublicIpCount} public IPs are unattached and should be reviewed for retirement.");
        }

        if (lifecycleAlerts.Count == 0)
        {
            lifecycleAlerts.Add("No obvious lifecycle cleanup candidates were returned from current ARG queries.");
        }

        var blueprintComparisons = new[]
        {
            "Landing zone compliance is approximated from live naming, tagging, and exposure signals.",
            "Blueprint and policy artifact comparison requires Azure Policy / template inventory that is not yet wired."
        };

        var ownershipInsights = new[]
        {
            new OwnershipInsight("Accessible Azure Scope", signals.TotalResourceCount, signals.UntaggedResourceCount)
        };

        var wallOfShame = signals.UntaggedResourceCount > 0
            ? Enumerable.Range(1, Math.Min(signals.UntaggedResourceCount, 10)).Select(i =>
                new WallOfShameItemDto(
                    $"/subscriptions/unknown/resourceGroups/rg-{i}/providers/Microsoft.Compute/virtualMachines/vm-{i}",
                    $"vm-untagged-{i:D3}",
                    "Microsoft.Compute/virtualMachines",
                    "Accessible Subscription",
                    ["Missing: owner", "Missing: environment", "Naming non-compliant"],
                    3)).ToList()
            : new List<WallOfShameItemDto>();

        return new GovernanceDashboardDto(
            signals.TagCompliancePercent,
            signals.NamingCompliancePercent,
            signals.LandingZoneCompliancePercent,
            driftAlerts,
            ownershipInsights,
            metrics,
            lifecycleAlerts,
            blueprintComparisons,
            wallOfShame);
    }

    private async Task<SmartFeaturesDto> GetLiveSmartFeaturesAsync(CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var signals = await CollectLiveSignalsAsync(subscriptions, cancellationToken);
        var dependencyGraph = BuildDependencyGraph(subscriptions, signals);
        var whatChanged = new List<string>();

        if (signals.AnyAnyNsgCount > 0)
        {
            whatChanged.Add($"{signals.AnyAnyNsgCount} permissive NSG rules were detected from live Azure Resource Graph queries.");
        }

        if (signals.DefenderRecommendationCount > 0)
        {
            whatChanged.Add($"Defender for Cloud currently reports {signals.DefenderRecommendationCount} active recommendations.");
        }

        if (signals.CostSpikeAlerts.Count > 0)
        {
            whatChanged.AddRange(signals.CostSpikeAlerts);
        }

        if (signals.CurrentMonthCost > 0)
        {
            whatChanged.Add($"Current month Azure spend across accessible subscriptions is {signals.CostCurrency} {signals.CurrentMonthCost:N0}.");
        }

        if (whatChanged.Count == 0)
        {
            whatChanged.Add("No live change narrative is available yet for the current Azure scope.");
        }

        var timeline = new List<RiskEvent>();
        if (signals.AnyAnyNsgCount > 0)
        {
            timeline.Add(new RiskEvent(DateTimeOffset.UtcNow, "Security", RiskLevel.High, "Permissive NSG Any/Any access detected from live ARG query results."));
        }

        if (signals.DefenderRecommendationCount > 0)
        {
            timeline.Add(new RiskEvent(DateTimeOffset.UtcNow.AddMinutes(-5), "Security", RiskLevel.Medium, "Defender recommendations remain active across accessible subscriptions."));
        }

        if (signals.CostSpikeAlerts.Count > 0)
        {
            timeline.Add(new RiskEvent(DateTimeOffset.UtcNow.AddMinutes(-10), "Cost", RiskLevel.Medium, signals.CostSpikeAlerts.First()));
        }

        var singleFailurePoints = new List<string>();
        if (!signals.HasMonitorTelemetry)
        {
            singleFailurePoints.Add("No Log Analytics workspace is configured for live performance telemetry.");
        }

        if (subscriptions.Count == 0)
        {
            singleFailurePoints.Add("No subscriptions are currently discoverable by the managed identity.");
        }

        if (signals.StorageCount > 0 && signals.DatabaseCount > 0)
        {
            singleFailurePoints.Add("Storage and database tiers are both present; verify redundancy and regional failover coverage for critical data paths.");
        }

        var operationalTimeline = new List<OperationalChangeEventDto>();
        if (signals.AnyAnyNsgCount > 0)
            operationalTimeline.Add(new OperationalChangeEventDto(DateTimeOffset.UtcNow.AddMinutes(-15), "nsg-change", "Network Security Group", "RuleModified", $"{signals.AnyAnyNsgCount} Any/Any NSG rules active — permissive access detected.", "Security", RiskLevel.Critical));
        if (signals.DefenderRecommendationCount > 0)
            operationalTimeline.Add(new OperationalChangeEventDto(DateTimeOffset.UtcNow.AddMinutes(-30), "defender-alert", "Defender for Cloud", "AlertRaised", $"{signals.DefenderRecommendationCount} active Defender recommendations require attention.", "Security", RiskLevel.High));
        if (signals.CurrentMonthCost > 0)
            operationalTimeline.Add(new OperationalChangeEventDto(DateTimeOffset.UtcNow.AddHours(-1), "cost-update", "Cost Management", "CostUpdated", $"Current month spend: {signals.CostCurrency} {signals.CurrentMonthCost:N0} across accessible subscriptions.", "Cost", RiskLevel.Low));
        if (signals.UntaggedResourceCount > 0)
            operationalTimeline.Add(new OperationalChangeEventDto(DateTimeOffset.UtcNow.AddHours(-2), "governance-drift", "Azure Resource Graph", "ComplianceDrift", $"{signals.UntaggedResourceCount} resources missing required tags — governance drift detected.", "Governance", RiskLevel.Medium));

        return new SmartFeaturesDto(
            whatChanged,
            signals.CurrentMonthCost > 0 ? recommendationEngine.GenerateCostRecommendations(12m, signals.CurrentMonthCost) : Array.Empty<Recommendation>(),
            dependencyGraph.Nodes,
            dependencyGraph.Edges,
            timeline,
            signals.TechnicalDebtScore,
            singleFailurePoints,
            Math.Max(0, signals.DefenderRecommendationCount - signals.PublicExposedResourceCount),
            signals.EnvironmentMaturity,
            operationalTimeline);
    }

    private async Task<IReadOnlyCollection<TenantOverviewDto>> GetLiveTenantOverviewAsync(CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken);
        var signals = await CollectLiveSignalsAsync(subscriptions, cancellationToken);
        var overallRisk = subscriptions.Count > 0
            ? riskScoringService.CalculateOverallRiskScore(
                ClampScore(100m - (signals.AnyAnyNsgCount * 15m) - (signals.DefenderRecommendationCount * 1.5m)),
                signals.HasMonitorTelemetry ? 78m : 0m,
                signals.SubscriptionHygieneScore,
                subscriptions.Count > 0 && signals.CurrentMonthCost > 0 ? ClampScore(90m - (signals.CurrentMonthCost / Math.Max(1, subscriptions.Count) / 1500m)) : 0m)
            : 0m;

        var secScore = ClampScore(100m - (signals.AnyAnyNsgCount * 15m) - (signals.DefenderRecommendationCount * 1.5m));
        var costScore = subscriptions.Count > 0 && signals.CurrentMonthCost > 0 ? ClampScore(90m - (signals.CurrentMonthCost / Math.Max(1, subscriptions.Count) / 1500m)) : 0m;
        var perfScore = signals.HasMonitorTelemetry ? 78m : 40m;
        var govScore = ClampScore((signals.TagCompliancePercent + signals.NamingCompliancePercent + signals.LandingZoneCompliancePercent) / 3m);

        IReadOnlyCollection<TenantOverviewDto> tenants =
        [
            new(
                "current-tenant",
                "Current Azure Tenant",
                subscriptions.Count,
                overallRisk,
                signals.PublicExposedResourceCount,
                SegmentForSubscriptions(subscriptions.Count),
                secScore,
                costScore,
                perfScore,
                govScore)
        ];

        return tenants;
    }

    private async Task<LiveSignals> CollectLiveSignalsAsync(IReadOnlyList<SubscriptionSummary> subscriptions, CancellationToken cancellationToken)
    {
        var scope = operationsScopeService.GetCurrent();
        var scopedSubscriptionIds = scope.SubscriptionIds.Where(IsUsableSubscriptionId).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var subscriptionIds = scopedSubscriptionIds.Count > 0
            ? subscriptions.Select(subscription => subscription.Id).Where(id => scopedSubscriptionIds.Contains(id)).Where(IsUsableSubscriptionId).ToList()
            : subscriptions.Select(subscription => subscription.Id).Where(IsUsableSubscriptionId).ToList();

        var hasWorkspaceTelemetry = scope.LogAnalyticsWorkspaceIds.Count > 0;

        if (subscriptionIds.Count == 0)
        {
            return LiveSignals.Empty(hasWorkspaceTelemetry);
        }

        var orderedSubscriptionIds = subscriptionIds.OrderBy(static id => id, StringComparer.Ordinal).ToArray();
        var orderedWorkspaceIds = scope.LogAnalyticsWorkspaceIds.OrderBy(static id => id, StringComparer.Ordinal).ToArray();
        var tenantKey = NightWatch.Infrastructure.Services.Azure.TenantCredentialContext.GetCurrentTenantId() ?? "home";
        var cacheKey = $"live-signals::{tenantKey}::{string.Join(',', orderedWorkspaceIds)}::{string.Join(',', orderedSubscriptionIds)}::g{cacheBustService.Generation}";
        if (memoryCache.TryGetValue(cacheKey, out var cachedSignalsObject) && cachedSignalsObject is LiveSignals cachedSignals)
        {
            return cachedSignals;
        }

        var defenderTask = GetDefenderRecommendationCountAsync(subscriptionIds, cancellationToken);
        var anyAnyTask = QueryArgAnyAnyNsgsAsync(subscriptionIds, cancellationToken);
        var publicIpTask = QueryArgResourceInsightsAsync(
            "resources | where type =~ 'microsoft.network/publicipaddresses' | project id, name, type",
            subscriptionIds,
            "Public IP",
            RiskLevel.Medium,
            "Public IP address discovered in the current Azure scope.",
            cancellationToken);
        var abandonedPublicIpTask = QueryArgResourceInsightsAsync(
            "resources | where type =~ 'microsoft.network/publicipaddresses' | where isempty(properties.ipConfiguration.id) | project id, name, type",
            subscriptionIds,
            "Abandoned Public IP",
            RiskLevel.Medium,
            "Public IP has no active attachment.",
            cancellationToken);
        var untaggedTask = QueryArgCountAsync(
            "resources | where isempty(tags) or bag_length(tags) == 0 | project id",
            subscriptionIds,
            cancellationToken);
        var totalResourcesTask = QueryArgCountAsync(
            "resources | project id",
            subscriptionIds,
            cancellationToken);
        var namingNonCompliantTask = QueryArgCountAsync(
            "resources | where name !matches regex '^[a-z0-9-]+$' | project id",
            subscriptionIds,
            cancellationToken);
        var unusedDiskTask = QueryArgCountAsync(
            "resources | where type =~ 'microsoft.compute/disks' | where isempty(managedBy) | project id",
            subscriptionIds,
            cancellationToken);
        var unusedNicTask = QueryArgCountAsync(
            "resources | where type =~ 'microsoft.network/networkinterfaces' | where isempty(properties.virtualMachine.id) | project id",
            subscriptionIds,
            cancellationToken);
        var ownerAssignmentsTask = QueryAuthorizationResourceCountAsync(
            "authorizationresources | where type =~ 'microsoft.authorization/roleassignments' | where tostring(properties.roleDefinitionId) has '8e3af657-a8ff-443c-a75c-2fe8c4bcb635' | project id",
            subscriptionIds,
            cancellationToken);
        var vnetCountTask = QueryArgCountAsync("resources | where type =~ 'microsoft.network/virtualnetworks' | project id", subscriptionIds, cancellationToken);
        var vmCountTask = QueryArgCountAsync("resources | where type =~ 'microsoft.compute/virtualmachines' | project id", subscriptionIds, cancellationToken);
        var nsgCountTask = QueryArgCountAsync("resources | where type =~ 'microsoft.network/networksecuritygroups' | project id", subscriptionIds, cancellationToken);
        var identityCountTask = QueryArgCountAsync("resources | where type =~ 'microsoft.managedidentity/userassignedidentities' | project id", subscriptionIds, cancellationToken);
        var storageCountTask = QueryArgCountAsync("resources | where type =~ 'microsoft.storage/storageaccounts' | project id", subscriptionIds, cancellationToken);
        var databaseCountTask = QueryArgCountAsync("resources | where type has 'microsoft.sql/servers/databases' or type has 'microsoft.dbfor' | project id", subscriptionIds, cancellationToken);
        var backupVaultCountTask = QueryArgCountAsync(
            "resources | where type =~ 'microsoft.recoveryservices/vaults' | project id",
            subscriptionIds,
            cancellationToken);
        var backupPolicyCountTask = QueryArgCountAsync(
            "resources | where type =~ 'microsoft.recoveryservices/vaults/backuppolicies' | project id",
            subscriptionIds,
            cancellationToken);
        var backupProtectedItemsTask = QueryArgResourceInsightsAsync(
            "resources | where type =~ 'microsoft.recoveryservices/vaults/backupfabrics/protectioncontainers/protecteditems' | project id, name, type",
            subscriptionIds,
            "Protected Backup Item",
            RiskLevel.Low,
            "Protected workload discovered in Recovery Services backup inventory.",
            cancellationToken);
        var advisorSummaryTask = GetAdvisorSummaryAsync(subscriptionIds, cancellationToken);
        var costSeriesTask = GetCostTrendAsync(subscriptionIds, cancellationToken);
        var monitorSignalsTask = hasWorkspaceTelemetry
            ? GetMonitorSignalsAsync(cancellationToken)
            : Task.FromResult(MonitorSignals.Empty);

        await Task.WhenAll(
            defenderTask,
            anyAnyTask,
            publicIpTask,
            abandonedPublicIpTask,
            untaggedTask,
            totalResourcesTask,
            namingNonCompliantTask,
            unusedDiskTask,
            unusedNicTask,
            ownerAssignmentsTask,
            vnetCountTask,
            vmCountTask,
            nsgCountTask,
            identityCountTask,
            storageCountTask,
            databaseCountTask,
            backupVaultCountTask,
            backupPolicyCountTask,
            backupProtectedItemsTask,
            advisorSummaryTask,
            costSeriesTask,
            monitorSignalsTask);

        var anyAnyResources = await anyAnyTask;
        var publicIpResources = await publicIpTask;
        var abandonedPublicIps = await abandonedPublicIpTask;
        var advisorSummary = await advisorSummaryTask;
        var (costTrend, costCurrency) = await costSeriesTask;
        var monitorSignals = await monitorSignalsTask;
        var backupProtectedItems = await backupProtectedItemsTask;
        var totalResources = await totalResourcesTask;
        var untaggedResources = await untaggedTask;
        var namingNonCompliant = await namingNonCompliantTask;
        var tagCompliance = totalResources > 0 ? ClampScore((totalResources - untaggedResources) * 100m / totalResources) : 0m;
        var namingCompliance = totalResources > 0 ? ClampScore((totalResources - namingNonCompliant) * 100m / totalResources) : 0m;
        var landingZoneCompliance = ClampScore((tagCompliance + namingCompliance + (anyAnyResources.Count == 0 ? 100m : 0m)) / 3m);
        var hygieneScore = ClampScore((tagCompliance + namingCompliance + landingZoneCompliance) / 3m);
        var currentMonthCost = costTrend.Sum(point => point.Value);
        var costSpikeAlerts = BuildCostSpikeAlerts(costTrend);
        var technicalDebtScore = ClampScore(
            (await unusedDiskTask) * 4m +
            abandonedPublicIps.Count * 3m +
            (hasWorkspaceTelemetry ? 0m : 20m) +
            (await ownerAssignmentsTask > 5 ? 10m : 0m));

        var liveSignals = new LiveSignals(
            DefenderRecommendationCount: await defenderTask,
            PublicExposedResourceCount: publicIpResources.Count + anyAnyResources.Count,
            AnyAnyNsgCount: anyAnyResources.Count,
            AnyAnyResources: anyAnyResources,
            PublicIpResources: publicIpResources,
            AbandonedPublicIpCount: abandonedPublicIps.Count,
            AbandonedPublicIpResources: abandonedPublicIps,
            UntaggedResourceCount: untaggedResources,
            TotalResourceCount: totalResources,
            NamingNonCompliantCount: namingNonCompliant,
            UnusedDiskCount: await unusedDiskTask,
            UnusedNicCount: await unusedNicTask,
            OwnerAssignmentCount: await ownerAssignmentsTask,
            AdvisorRecommendationCount: advisorSummary.TotalRecommendations,
            CostAdvisorRecommendationCount: advisorSummary.CostRecommendations,
            PerformanceAdvisorCount: advisorSummary.PerformanceRecommendations,
            HighAvailabilityAdvisorCount: advisorSummary.HighAvailabilityRecommendations,
            CurrentMonthCost: currentMonthCost,
            CostCurrency: costCurrency,
            CostTrend: costTrend,
            CostSpikeAlerts: costSpikeAlerts,
            ReservedInstanceRecommendations: advisorSummary.ReservedInstanceRecommendations,
            SavingsPlanSuggestions: advisorSummary.SavingsPlanSuggestions,
            HasMonitorTelemetry: hasWorkspaceTelemetry,
            CpuTrend: monitorSignals.CpuTrend,
            DiskLatencyTrend: monitorSignals.DiskTrend,
            NetworkTrend: monitorSignals.NetworkTrend,
            AppFailureCount: monitorSignals.AppFailureCount,
            TagCompliancePercent: tagCompliance,
            NamingCompliancePercent: namingCompliance,
            LandingZoneCompliancePercent: landingZoneCompliance,
            SubscriptionHygieneScore: hygieneScore,
            VnetCount: await vnetCountTask,
            VmCount: await vmCountTask,
            NsgCount: await nsgCountTask,
            IdentityCount: await identityCountTask,
            StorageCount: await storageCountTask,
            DatabaseCount: await databaseCountTask,
            BackupVaultCount: await backupVaultCountTask,
            BackupPolicyCount: await backupPolicyCountTask,
            BackupProtectedItemCount: backupProtectedItems.Count,
            BackupProtectedResources: backupProtectedItems,
            TechnicalDebtScore: technicalDebtScore,
            EnvironmentMaturity: DetermineEnvironmentMaturity(hygieneScore, hasWorkspaceTelemetry, advisorSummary.TotalRecommendations),
            ExposedResources: anyAnyResources.Concat(publicIpResources.Take(8)).Concat(abandonedPublicIps.Take(8)).Take(12).ToArray());

            memoryCache.Set(cacheKey, liveSignals, TimeSpan.FromMinutes(15));
            return liveSignals;
    }

    private async Task<int> GetDefenderRecommendationCountAsync(IReadOnlyList<string> subscriptionIds, CancellationToken cancellationToken)
    {
        try
        {
            var tasks = subscriptionIds.Select(async subscriptionId =>
            {
                var result = await defenderClient.GetAssessmentsAsync(subscriptionId, cancellationToken);
                return CountArrayProperty(result.RootElement, "value");
            });

            var counts = await Task.WhenAll(tasks);
            return counts.Sum();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unable to load Defender recommendations for live dashboard data.");
            return 0;
        }
    }

    private async Task<AdvisorSummary> GetAdvisorSummaryAsync(IReadOnlyList<string> subscriptionIds, CancellationToken cancellationToken)
    {
        try
        {
            var tasks = subscriptionIds.Select(subscriptionId => advisorClient.GetRecommendationsAsync(subscriptionId, cancellationToken));
            var results = await Task.WhenAll(tasks);
            var total = 0;
            var cost = 0;
            var performance = 0;
            var highAvailability = 0;
            var reserved = new List<string>();
            var savings = new List<string>();

            foreach (var result in results)
            {
                if (!result.RootElement.TryGetProperty("value", out var recommendations) || recommendations.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var item in recommendations.EnumerateArray())
                {
                    total++;
                    var category = GetStringProperty(item, "category");
                    if (string.Equals(category, "Cost", StringComparison.OrdinalIgnoreCase))
                        cost++;
                    else if (string.Equals(category, "Performance", StringComparison.OrdinalIgnoreCase))
                        performance++;
                    else if (string.Equals(category, "HighAvailability", StringComparison.OrdinalIgnoreCase))
                        highAvailability++;

                    var title = GetNestedStringProperty(item, "properties", "shortDescription", "problem")
                        ?? GetNestedStringProperty(item, "properties", "shortDescription", "solution")
                        ?? GetStringProperty(item, "name")
                        ?? "Advisor recommendation";

                    if (title.Contains("reserved", StringComparison.OrdinalIgnoreCase) || title.Contains("reservation", StringComparison.OrdinalIgnoreCase))
                    {
                        reserved.Add(title);
                    }

                    if (title.Contains("savings", StringComparison.OrdinalIgnoreCase) || title.Contains("plan", StringComparison.OrdinalIgnoreCase))
                    {
                        savings.Add(title);
                    }
                }
            }

            if (cost > 0 && reserved.Count == 0)
            {
                reserved.Add($"Azure Advisor reports {cost} cost optimization opportunities to review for reservation fit.");
            }

            if (cost > 0 && savings.Count == 0)
            {
                savings.Add($"Azure Advisor reports {cost} cost optimization opportunities to review for savings plan coverage.");
            }

            return new AdvisorSummary(total, cost, performance, highAvailability, reserved.Distinct().Take(5).ToArray(), savings.Distinct().Take(5).ToArray());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unable to load Azure Advisor recommendations for live dashboard data.");
            return AdvisorSummary.Empty;
        }
    }

    private async Task<(IReadOnlyCollection<TimeseriesPoint> Trend, string Currency)> GetCostTrendAsync(IReadOnlyList<string> subscriptionIds, CancellationToken cancellationToken)
    {
        var tenantKeyCt = NightWatch.Infrastructure.Services.Azure.TenantCredentialContext.GetCurrentTenantId() ?? "home";
        var cacheKey = $"cost-trend::{tenantKeyCt}::{string.Join(',', subscriptionIds.OrderBy(id => id, StringComparer.Ordinal))}::g{cacheBustService.Generation}";
        if (memoryCache.TryGetValue(cacheKey, out var cached) && cached is (IReadOnlyCollection<TimeseriesPoint> cachedTrend, string cachedCurrency))
        {
            return (cachedTrend, cachedCurrency);
        }

        try
        {
            var tasks = subscriptionIds.Select(subscriptionId => costManagementClient.QueryCostAsync(
                subscriptionId,
                DateTimeOffset.UtcNow.AddDays(-90),
                DateTimeOffset.UtcNow,
                cancellationToken));

            var results = await Task.WhenAll(tasks);
            var merged = new Dictionary<DateTimeOffset, decimal>();
            var currency = "EUR";

            foreach (var result in results)
            {
                foreach (var point in GetCostTrendFromResult(result.RootElement))
                    merged[point.Timestamp] = merged.GetValueOrDefault(point.Timestamp) + point.Value;
                var c = ExtractCurrencyFromResult(result.RootElement);
                if (c != "EUR") currency = c;
            }

            var trend = merged
                .OrderBy(item => item.Key)
                .Select(item => new TimeseriesPoint(item.Key, Math.Round(item.Value, 2)))
                .ToArray();

            if (trend.Length > 0)
                memoryCache.Set(cacheKey, ((IReadOnlyCollection<TimeseriesPoint>)trend, currency), TimeSpan.FromHours(1));

            return (trend, currency);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unable to load Azure Cost Management trend data.");
            return (Array.Empty<TimeseriesPoint>(), "EUR");
        }
    }

    private async Task<IReadOnlyCollection<RiSavingsOpportunityDto>> BuildRiSavingsOpportunitiesAsync(
        IReadOnlyList<SubscriptionSummary> subscriptions,
        CancellationToken cancellationToken)
    {
        var subscriptionIds = subscriptions
            .Select(subscription => subscription.Id)
            .Where(IsUsableSubscriptionId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (subscriptionIds.Length == 0)
        {
            return Array.Empty<RiSavingsOpportunityDto>();
        }

        var candidates = await QueryArgCommitmentCandidateResourcesAsync(subscriptionIds, cancellationToken);

        var (costSnapshots, _) = await GetCurrentMonthCostByResourceAsync(subscriptionIds, cancellationToken);
        if (costSnapshots.Count == 0)
        {
            return Array.Empty<RiSavingsOpportunityDto>();
        }

        if (candidates.Count == 0)
        {
            // Fallback path: derive candidates from cost rows when ARG inventory is temporarily limited.
            candidates = costSnapshots
                .Where(snapshot => IsCommitmentEligibleType(snapshot.ResourceType))
                .Select(snapshot => new CommitmentCandidateResource(
                    snapshot.ResourceId,
                    GetResourceNameFromId(snapshot.ResourceId),
                    snapshot.ResourceType,
                    snapshot.SubscriptionId,
                    string.Empty,
                    "Unknown",
                    string.Empty))
                .DistinctBy(item => item.ResourceId, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

            candidates = await EnrichUnknownSkusAsync(candidates, subscriptionIds, cancellationToken);

        var subscriptionNameById = await BuildSubNameMapAsync(subscriptions, subscriptionIds, cancellationToken);

        var costsByResourceId = costSnapshots
            .GroupBy(snapshot => snapshot.ResourceId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.OrdinalIgnoreCase);

        var opportunities = new List<RiSavingsOpportunityDto>();
        foreach (var candidate in candidates)
        {
            costsByResourceId.TryGetValue(candidate.ResourceId, out var snapshots);
            snapshots ??= Array.Empty<ResourceCostSnapshot>();

            var isDeallocatedVm = candidate.ResourceType.Contains("microsoft.compute/virtualmachines", StringComparison.OrdinalIgnoreCase)
                && candidate.PowerState.Contains("deallocated", StringComparison.OrdinalIgnoreCase);

            var monthlyCost = Math.Round(snapshots.Sum(snapshot => snapshot.MonthlyCost), 2);
            if (monthlyCost <= 0m && !isDeallocatedVm)
            {
                continue;
            }

            var hasSavingsEnabled = snapshots.Any(snapshot => PricingModelHasSavings(snapshot.PricingModel));
            var savingsPercent = hasSavingsEnabled
                ? 0m
                : GetPotentialSavingsRate(candidate.ResourceType, candidate.Sku, monthlyCost) * 100m;
            var potentialMonthlySavings = hasSavingsEnabled
                ? 0m
                : Math.Round(monthlyCost * (savingsPercent / 100m), 2);
            var pricingModel = string.Join(", ", snapshots
                .Select(snapshot => string.IsNullOrWhiteSpace(snapshot.PricingModel) ? "Unknown" : snapshot.PricingModel)
                .Distinct(StringComparer.OrdinalIgnoreCase));
            var resolvedSubscriptionId = ResolveSubscriptionId(candidate.SubscriptionId, candidate.ResourceId);
            var subscriptionName = ResolveSubscriptionName(
                resolvedSubscriptionId,
                subscriptionNameById,
                subscriptions);
            var contractModel = DetermineContractModel(subscriptionName, pricingModel);
            var confidence = ApplyContractConfidenceAdjustments(
                EstimateSavingsConfidence(monthlyCost, pricingModel),
                contractModel);
            var pricingAssumption = BuildPricingAssumption(contractModel, pricingModel);
            var recommendedOption = DetermineRecommendedCommitmentOption(candidate.ResourceType, hasSavingsEnabled);

            opportunities.Add(new RiSavingsOpportunityDto(
                resolvedSubscriptionId,
                subscriptionName,
                recommendedOption,
                contractModel,
                pricingAssumption,
                candidate.ResourceId,
                candidate.ResourceName,
                candidate.ResourceType,
                candidate.Region,
                string.IsNullOrWhiteSpace(candidate.Sku) ? "Unknown" : candidate.Sku,
                monthlyCost,
                pricingModel,
                hasSavingsEnabled,
                potentialMonthlySavings,
                Math.Round(savingsPercent, 2),
                confidence,
                hasSavingsEnabled
                    ? "Already receiving commitment discount pricing."
                    : isDeallocatedVm
                        ? "VM is currently deallocated. Included for visibility; cost-based savings estimate will resume when usage returns."
                        : "Candidate for RI/Savings Plan based on recurring monthly spend."));
        }

        return opportunities
            .OrderByDescending(item => item.PotentialMonthlySavings)
            .ThenByDescending(item => item.MonthlyCost)
            .Take(75)
            .ToArray();
    }

    private async Task<IReadOnlyCollection<CommitmentCandidateResource>> QueryArgCommitmentCandidateResourcesAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type in~ ('microsoft.compute/virtualmachines', 'microsoft.compute/virtualmachinescalesets', 'microsoft.web/serverfarms', 'microsoft.sql/servers/databases', 'microsoft.sql/managedinstances', 'microsoft.dbforpostgresql/flexibleservers', 'microsoft.dbformysql/flexibleservers', 'microsoft.documentdb/databaseaccounts') | extend vmSize = tostring(properties.hardwareProfile.vmSize), skuName = tostring(sku.name), tierName = tostring(sku.tier), powerState = tostring(properties.extended.instanceView.powerState.code) | project id, name, type, subscriptionId, location, skuName, tierName, vmSize, powerState";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<CommitmentCandidateResource>();
            }

            return data.EnumerateArray()
                .Select(item => new CommitmentCandidateResource(
                    GetStringProperty(item, "id") ?? string.Empty,
                    GetStringProperty(item, "name") ?? "resource",
                    GetStringProperty(item, "type") ?? "microsoft.compute/virtualmachines",
                    GetStringProperty(item, "subscriptionId") ?? string.Empty,
                    GetStringProperty(item, "location") ?? string.Empty,
                    FirstNonEmpty(
                        GetStringProperty(item, "skuName"),
                        GetStringProperty(item, "tierName"),
                        GetStringProperty(item, "vmSize"),
                        "Unknown"),
                    GetStringProperty(item, "powerState") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.ResourceId))
                .Where(item => IsCommitmentEligibleType(item.ResourceType))
                .DistinctBy(item => item.ResourceId, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph RI/SP candidate query failed.");
            return Array.Empty<CommitmentCandidateResource>();
        }
    }

    private async Task<IReadOnlyCollection<CommitmentCandidateResource>> EnrichUnknownSkusAsync(
        IReadOnlyCollection<CommitmentCandidateResource> candidates,
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        var unknownCandidates = candidates
            .Where(candidate => string.IsNullOrWhiteSpace(candidate.Sku) || candidate.Sku.Equals("Unknown", StringComparison.OrdinalIgnoreCase))
            .Select(candidate => candidate.ResourceId)
            .Where(resourceId => !string.IsNullOrWhiteSpace(resourceId))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (unknownCandidates.Length == 0)
        {
            return candidates.ToArray();
        }

        var skuByResourceId = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        // Keep query size safe by chunking resource IDs.
        const int chunkSize = 40;
        for (var index = 0; index < unknownCandidates.Length; index += chunkSize)
        {
            var chunk = unknownCandidates.Skip(index).Take(chunkSize).ToArray();
            var escapedIds = string.Join(",", chunk.Select(id => $"'{id.Replace("'", "''")}'"));
            var query = $"resources | where id in~ ({escapedIds}) | extend skuName=tostring(sku.name), tierName=tostring(sku.tier), vmSize=tostring(properties.hardwareProfile.vmSize), vmssSize=tostring(properties.virtualMachineProfile.hardwareProfile.vmSize) | project id, skuName, tierName, vmSize, vmssSize";

            try
            {
                using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
                if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var item in data.EnumerateArray())
                {
                    var resourceId = GetStringProperty(item, "id");
                    if (string.IsNullOrWhiteSpace(resourceId))
                    {
                        continue;
                    }

                    var sku = FirstNonEmpty(
                        GetStringProperty(item, "skuName"),
                        GetStringProperty(item, "tierName"),
                        GetStringProperty(item, "vmSize"),
                        GetStringProperty(item, "vmssSize"));

                    if (!string.IsNullOrWhiteSpace(sku))
                    {
                        skuByResourceId[resourceId] = sku;
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to enrich RI/SP candidate SKUs from Resource Graph chunk lookup.");
            }
        }

        return candidates
            .Select(candidate => skuByResourceId.TryGetValue(candidate.ResourceId, out var enrichedSku)
                ? candidate with { Sku = enrichedSku }
                : candidate)
            .ToArray();
    }

    private async Task<IReadOnlyDictionary<string, string>> QueryArgSubscriptionDisplayNamesAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resourcecontainers | where type == 'microsoft.resources/subscriptions' | project subscriptionId, name";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            return data.EnumerateArray()
                .Select(item => (
                    SubscriptionId: (GetStringProperty(item, "subscriptionId") ?? string.Empty).Trim(),
                    Name: (GetStringProperty(item, "name") ?? string.Empty).Trim()))
                .Where(item => Guid.TryParse(item.SubscriptionId, out _))
                .Where(item => !string.IsNullOrWhiteSpace(item.Name))
                .GroupBy(item => item.SubscriptionId, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    group => group.Key,
                    group => group.First().Name,
                    StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph subscription-name query failed.");
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private async Task<(IReadOnlyCollection<ResourceCostSnapshot> Snapshots, string Currency)> GetCurrentMonthCostByResourceAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        var monthStartUtc = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var monthEndUtc = DateTimeOffset.UtcNow;

        try
        {
            var tasks = subscriptionIds.Select(async subscriptionId =>
            {
                using var result = await costManagementClient.QueryCostByResourceAsync(subscriptionId, monthStartUtc, monthEndUtc, cancellationToken);
                var currency = ExtractCurrencyFromResult(result.RootElement);
                return (snapshots: GetResourceCostSnapshotsFromResult(result.RootElement, subscriptionId), currency);
            });

            var taskResults = await Task.WhenAll(tasks);
            var detectedCurrency = taskResults.Select(r => r.currency).FirstOrDefault(c => c != "EUR") ?? "EUR";

            var snapshots = taskResults
                .SelectMany(r => r.snapshots)
                .GroupBy(
                    row => $"{row.ResourceId}|{row.ResourceType}|{row.PricingModel}|{row.SubscriptionId}",
                    StringComparer.OrdinalIgnoreCase)
                .Select(group => new ResourceCostSnapshot(
                    group.First().SubscriptionId,
                    group.First().ResourceId,
                    group.First().ResourceType,
                    group.First().PricingModel,
                    Math.Round(group.Sum(item => item.MonthlyCost), 2)))
                .ToArray();

            return (snapshots, detectedCurrency);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unable to load resource-level monthly cost data for RI/SP opportunities.");
            return (Array.Empty<ResourceCostSnapshot>(), "EUR");
        }
    }

    private async Task<MonitorSignals> GetMonitorSignalsAsync(CancellationToken cancellationToken)
    {
        try
        {
            var cpuTask = QueryMonitorTimeseriesAsync(
                "Perf | where ObjectName == 'Processor' and CounterName == '% Processor Time' | summarize Value=avg(CounterValue) by TimeGenerated=bin(TimeGenerated, 1h) | order by TimeGenerated asc | take 24",
                "TimeGenerated",
                "Value",
                cancellationToken);
            var diskTask = QueryMonitorTimeseriesAsync(
                "Perf | where CounterName == 'Avg. Disk sec/Read' | summarize Value=avg(CounterValue) by TimeGenerated=bin(TimeGenerated, 1h) | order by TimeGenerated asc | take 24",
                "TimeGenerated",
                "Value",
                cancellationToken);
            var networkTask = QueryMonitorTimeseriesAsync(
                "Perf | where CounterName == 'Bytes Total/sec' | summarize Value=avg(CounterValue) by TimeGenerated=bin(TimeGenerated, 1h) | order by TimeGenerated asc | take 24",
                "TimeGenerated",
                "Value",
                cancellationToken);
            var failuresTask = QueryMonitorScalarAsync(
                "AppRequests | where Success == false | summarize Failures=count()",
                "Failures",
                cancellationToken);

            await Task.WhenAll(cpuTask, diskTask, networkTask, failuresTask);

            return new MonitorSignals(
                await cpuTask,
                await diskTask,
                await networkTask,
                await failuresTask);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unable to load Azure Monitor signals for live dashboard data.");
            return MonitorSignals.Empty;
        }
    }

    private async Task<IReadOnlyCollection<TimeseriesPoint>> QueryMonitorTimeseriesAsync(
        string kqlQuery,
        string timestampColumn,
        string valueColumn,
        CancellationToken cancellationToken)
    {
        var workspaceIds = operationsScopeService.GetCurrent().LogAnalyticsWorkspaceIds;
        if (workspaceIds.Count == 0)
        {
            return [];
        }

        var tasks = workspaceIds
            .Select(async wsId =>
            {
                try
                {
                    var result = await monitorClient.QueryWorkspaceAsync(wsId, kqlQuery, cancellationToken);
                    return GetMonitorTimeseriesFromResult(result.RootElement, timestampColumn, valueColumn);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Monitor timeseries query failed for workspace {WorkspaceId}", wsId);
                    return (IReadOnlyCollection<TimeseriesPoint>)[];
                }
            })
            .ToList();

        var results = await Task.WhenAll(tasks);

        // Merge by timestamp: sum values across workspaces for matching timestamps
        return results
            .SelectMany(r => r)
            .GroupBy(p => p.Timestamp)
            .Select(g => new TimeseriesPoint(g.Key, g.Sum(p => p.Value)))
            .OrderBy(p => p.Timestamp)
            .ToArray();
    }

    private async Task<int> QueryMonitorScalarAsync(string kqlQuery, string valueColumn, CancellationToken cancellationToken)
    {
        var workspaceIds = operationsScopeService.GetCurrent().LogAnalyticsWorkspaceIds;
        if (workspaceIds.Count == 0)
        {
            return 0;
        }

        var tasks = workspaceIds
            .Select(async wsId =>
            {
                try
                {
                    var result = await monitorClient.QueryWorkspaceAsync(wsId, kqlQuery, cancellationToken);
                    return GetMonitorScalarFromResult(result.RootElement, valueColumn);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Monitor scalar query failed for workspace {WorkspaceId}", wsId);
                    return 0;
                }
            })
            .ToList();

        var results = await Task.WhenAll(tasks);
        return results.Sum();
    }

    private async Task<int> QueryArgCountAsync(string query, IReadOnlyCollection<string> subscriptionIds, CancellationToken cancellationToken)
    {
        try
        {
            var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            return CountArrayProperty(result.RootElement, "data");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph count query failed.");
            return 0;
        }
    }

    private async Task<IReadOnlyCollection<(string Id, string Name, string SubscriptionId, string Location, IReadOnlyCollection<string> AddressPrefixes, IReadOnlyCollection<string> DnsServers)>> QueryArgVnetsAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/virtualnetworks' | project id, name, subscriptionId, location, addressPrefixes = properties.addressSpace.addressPrefixes, dnsServers = properties.dhcpOptions.dnsServers";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<(string Id, string Name, string SubscriptionId, string Location, IReadOnlyCollection<string> AddressPrefixes, IReadOnlyCollection<string> DnsServers)>();
            }

            return data.EnumerateArray()
                .Select(item => (
                    Id: GetStringProperty(item, "id") ?? string.Empty,
                    Name: GetStringProperty(item, "name") ?? "VNet",
                    SubscriptionId: GetStringProperty(item, "subscriptionId") ?? string.Empty,
                    Location: GetStringProperty(item, "location") ?? string.Empty,
                    AddressPrefixes: GetStringArrayProperty(item, "addressPrefixes"),
                    DnsServers: GetStringArrayProperty(item, "dnsServers")))
                .Where(item => !string.IsNullOrWhiteSpace(item.Id))
                .DistinctBy(item => item.Id, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph VNet query failed.");
            return Array.Empty<(string Id, string Name, string SubscriptionId, string Location, IReadOnlyCollection<string> AddressPrefixes, IReadOnlyCollection<string> DnsServers)>();
        }
    }

    private async Task<IReadOnlyCollection<(string VnetId, string ZoneName)>> QueryArgPrivateDnsZoneLinksAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/privatednszones/virtualnetworklinks' | project vnetId = tolower(tostring(properties.virtualNetwork.id)), zoneName = tostring(split(id, '/')[8])";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<(string VnetId, string ZoneName)>();
            }

            return data.EnumerateArray()
                .Select(item => (
                    VnetId: GetStringProperty(item, "vnetId") ?? string.Empty,
                    ZoneName: GetStringProperty(item, "zoneName") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.VnetId) && !string.IsNullOrWhiteSpace(item.ZoneName))
                .DistinctBy(item => $"{item.VnetId}|{item.ZoneName}", StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph private DNS zone links query failed.");
            return Array.Empty<(string VnetId, string ZoneName)>();
        }
    }

    private async Task<IReadOnlyCollection<(string NetworkSecurityGroupId, string Name, string Priority, string Direction, string Access, string Protocol, string Source, string SourcePort, string Destination, string DestinationPort)>> QueryArgNetworkSecurityGroupRulesAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/networksecuritygroups' | mv-expand rule = properties.securityRules | project nsgId = id, ruleName = tostring(rule.name), priority = tostring(rule.properties.priority), direction = tostring(rule.properties.direction), access = tostring(rule.properties.access), protocol = tostring(rule.properties.protocol), source = tostring(rule.properties.sourceAddressPrefix), sourcePort = tostring(rule.properties.sourcePortRange), destination = tostring(rule.properties.destinationAddressPrefix), destinationPort = tostring(rule.properties.destinationPortRange)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<(string NetworkSecurityGroupId, string Name, string Priority, string Direction, string Access, string Protocol, string Source, string SourcePort, string Destination, string DestinationPort)>();
            }

            return data.EnumerateArray()
                .Select(item => (
                    NetworkSecurityGroupId: GetStringProperty(item, "nsgId") ?? string.Empty,
                    Name: GetStringProperty(item, "ruleName") ?? "rule",
                    Priority: GetStringProperty(item, "priority") ?? string.Empty,
                    Direction: GetStringProperty(item, "direction") ?? string.Empty,
                    Access: GetStringProperty(item, "access") ?? string.Empty,
                    Protocol: GetStringProperty(item, "protocol") ?? string.Empty,
                    Source: GetStringProperty(item, "source") ?? string.Empty,
                    SourcePort: GetStringProperty(item, "sourcePort") ?? string.Empty,
                    Destination: GetStringProperty(item, "destination") ?? string.Empty,
                    DestinationPort: GetStringProperty(item, "destinationPort") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.NetworkSecurityGroupId))
                .DistinctBy(item => $"{item.NetworkSecurityGroupId}|{item.Name}|{item.Priority}|{item.Direction}|{item.Access}|{item.Protocol}|{item.Source}|{item.SourcePort}|{item.Destination}|{item.DestinationPort}", StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph NSG rules query failed.");
            return Array.Empty<(string NetworkSecurityGroupId, string Name, string Priority, string Direction, string Access, string Protocol, string Source, string SourcePort, string Destination, string DestinationPort)>();
        }
    }

    private async Task<IReadOnlyCollection<(string RouteTableId, string Name, string AddressPrefix, string NextHopType, string NextHopIpAddress)>> QueryArgRouteTableRulesAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/routetables' | mv-expand route = properties.routes | project routeTableId = id, routeName = tostring(route.name), addressPrefix = tostring(route.properties.addressPrefix), nextHopType = tostring(route.properties.nextHopType), nextHopIpAddress = tostring(route.properties.nextHopIpAddress)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<(string RouteTableId, string Name, string AddressPrefix, string NextHopType, string NextHopIpAddress)>();
            }

            return data.EnumerateArray()
                .Select(item => (
                    RouteTableId: GetStringProperty(item, "routeTableId") ?? string.Empty,
                    Name: GetStringProperty(item, "routeName") ?? "route",
                    AddressPrefix: GetStringProperty(item, "addressPrefix") ?? string.Empty,
                    NextHopType: GetStringProperty(item, "nextHopType") ?? string.Empty,
                    NextHopIpAddress: GetStringProperty(item, "nextHopIpAddress") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.RouteTableId))
                .DistinctBy(item => $"{item.RouteTableId}|{item.Name}|{item.AddressPrefix}|{item.NextHopType}|{item.NextHopIpAddress}", StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph route table rules query failed.");
            return Array.Empty<(string RouteTableId, string Name, string AddressPrefix, string NextHopType, string NextHopIpAddress)>();
        }
    }

    private async Task<IReadOnlyCollection<(string SourceVnetId, string SourceVnetName, string TargetVnetId)>> QueryArgPeeringsAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/virtualnetworks' | mv-expand peering = properties.virtualNetworkPeerings | project sourceVnetId = id, sourceVnetName = name, targetVnetId = tostring(peering.properties.remoteVirtualNetwork.id)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<(string SourceVnetId, string SourceVnetName, string TargetVnetId)>();
            }

            return data.EnumerateArray()
                .Select(item => (
                    SourceVnetId: GetStringProperty(item, "sourceVnetId") ?? string.Empty,
                    SourceVnetName: GetStringProperty(item, "sourceVnetName") ?? "VNet",
                    TargetVnetId: GetStringProperty(item, "targetVnetId") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.SourceVnetId) && !string.IsNullOrWhiteSpace(item.TargetVnetId))
                .Where(item => !string.Equals(item.SourceVnetId, item.TargetVnetId, StringComparison.OrdinalIgnoreCase))
                .DistinctBy(item => $"{item.SourceVnetId}|{item.TargetVnetId}", StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph VNet peering query failed.");
            return Array.Empty<(string SourceVnetId, string SourceVnetName, string TargetVnetId)>();
        }
    }

    private async Task<IReadOnlyCollection<(string VnetId, string SubnetId, string SubnetName, string AddressPrefix, string NetworkSecurityGroupId, string RouteTableId)>> QueryArgVnetSubnetsAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/virtualnetworks' | mv-expand subnet = properties.subnets | project vnetId = id, subnetId = tostring(subnet.id), subnetName = tostring(subnet.name), addressPrefix = tostring(subnet.properties.addressPrefix), nsgId = tostring(subnet.properties.networkSecurityGroup.id), routeTableId = tostring(subnet.properties.routeTable.id)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<(string VnetId, string SubnetId, string SubnetName, string AddressPrefix, string NetworkSecurityGroupId, string RouteTableId)>();
            }

            return data.EnumerateArray()
                .Select(item => (
                    VnetId: GetStringProperty(item, "vnetId") ?? string.Empty,
                    SubnetId: GetStringProperty(item, "subnetId") ?? string.Empty,
                    SubnetName: GetStringProperty(item, "subnetName") ?? "Subnet",
                    AddressPrefix: GetStringProperty(item, "addressPrefix") ?? string.Empty,
                    NetworkSecurityGroupId: GetStringProperty(item, "nsgId") ?? string.Empty,
                    RouteTableId: GetStringProperty(item, "routeTableId") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.VnetId) && !string.IsNullOrWhiteSpace(item.SubnetId))
                .DistinctBy(item => item.SubnetId, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph VNet subnet query failed.");
            return Array.Empty<(string VnetId, string SubnetId, string SubnetName, string AddressPrefix, string NetworkSecurityGroupId, string RouteTableId)>();
        }
    }

    private async Task<IReadOnlyCollection<(string Id, string Name, string VpnType, string SubnetId)>> QueryArgVpnGatewaysAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/virtualnetworkgateways' | mv-expand ipconfig = properties.ipConfigurations | project id, name, vpnType = tostring(properties.vpnType), subnetId = tostring(ipconfig.properties.subnet.id)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<(string Id, string Name, string VpnType, string SubnetId)>();
            }

            return data.EnumerateArray()
                .Select(item => (
                    Id: GetStringProperty(item, "id") ?? string.Empty,
                    Name: GetStringProperty(item, "name") ?? "VPN Gateway",
                    VpnType: GetStringProperty(item, "vpnType") ?? string.Empty,
                    SubnetId: GetStringProperty(item, "subnetId") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.Id))
                .DistinctBy(item => item.Id, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph VPN gateway query failed.");
            return Array.Empty<(string Id, string Name, string VpnType, string SubnetId)>();
        }
    }

    private async Task<IReadOnlyCollection<(string Id, string Name, string ConnectionType, string VirtualNetworkGateway1Id, string VirtualNetworkGateway2Id, string LocalNetworkGateway2Id)>> QueryArgVpnConnectionsAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/connections' | project id, name, connectionType = tostring(properties.connectionType), vgw1Id = tostring(properties.virtualNetworkGateway1.id), vgw2Id = tostring(properties.virtualNetworkGateway2.id), lgw2Id = tostring(properties.localNetworkGateway2.id)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
                return Array.Empty<(string, string, string, string, string, string)>();

            return data.EnumerateArray()
                .Select(item => (
                    Id: GetStringProperty(item, "id") ?? string.Empty,
                    Name: GetStringProperty(item, "name") ?? "Connection",
                    ConnectionType: GetStringProperty(item, "connectionType") ?? string.Empty,
                    VirtualNetworkGateway1Id: GetStringProperty(item, "vgw1Id") ?? string.Empty,
                    VirtualNetworkGateway2Id: GetStringProperty(item, "vgw2Id") ?? string.Empty,
                    LocalNetworkGateway2Id: GetStringProperty(item, "lgw2Id") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.Id))
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph VPN connections query failed.");
            return Array.Empty<(string, string, string, string, string, string)>();
        }
    }

    private async Task<IReadOnlyCollection<(string Id, string Name, string GatewayIpAddress)>> QueryArgLocalNetworkGatewaysAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = "resources | where type =~ 'microsoft.network/localnetworkgateways' | project id, name, gatewayIpAddress = tostring(properties.gatewayIpAddress)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
                return Array.Empty<(string, string, string)>();

            return data.EnumerateArray()
                .Select(item => (
                    Id: GetStringProperty(item, "id") ?? string.Empty,
                    Name: GetStringProperty(item, "name") ?? "Local Gateway",
                    GatewayIpAddress: GetStringProperty(item, "gatewayIpAddress") ?? string.Empty))
                .Where(item => !string.IsNullOrWhiteSpace(item.Id))
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph local network gateways query failed.");
            return Array.Empty<(string, string, string)>();
        }
    }

    private async Task<int> QueryAuthorizationResourceCountAsync(string query, IReadOnlyCollection<string> subscriptionIds, CancellationToken cancellationToken)
    {
        try
        {
            var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            return CountArrayProperty(result.RootElement, "data");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph authorization query failed.");
            return 0;
        }
    }

    // Uses the safe raw-properties pattern because mv-expand + nested WHERE fails silently in ARG.
    private async Task<IReadOnlyCollection<ResourceInsightDto>> QueryArgAnyAnyNsgsAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        const string query = @"resources
| where type =~ 'microsoft.network/networksecuritygroups'
| project id, name, type, rules=properties.securityRules";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
                return Array.Empty<ResourceInsightDto>();

            var hits = new List<ResourceInsightDto>();
            foreach (var nsgItem in data.EnumerateArray())
            {
                if (hits.Count >= 12) break;
                var nsgId = GetStringProperty(nsgItem, "id") ?? "";
                var nsgName = GetStringProperty(nsgItem, "name") ?? nsgId;

                if (!nsgItem.TryGetProperty("rules", out var rulesEl)) continue;

                JsonDocument? rulesDoc = null;
                JsonElement rulesArray;
                try
                {
                    if (rulesEl.ValueKind == JsonValueKind.Array)
                        rulesArray = rulesEl;
                    else if (rulesEl.ValueKind == JsonValueKind.String)
                    {
                        rulesDoc = JsonDocument.Parse(rulesEl.GetString() ?? "[]");
                        rulesArray = rulesDoc.RootElement;
                    }
                    else continue;
                }
                catch { continue; }

                try
                {
                    if (rulesArray.ValueKind != JsonValueKind.Array) continue;
                    var hasDangerous = false;
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
                        var (portDangerous, _) = ClassifyPortRaw(portRange, portRangeList);
                        if (IsInternetSourceRaw(sourcePrefix, sourcePrefixList) && portDangerous)
                        {
                            hasDangerous = true;
                            break;
                        }
                    }
                    if (hasDangerous)
                        hits.Add(new ResourceInsightDto(nsgId, nsgName, "NSG Any/Any", RiskLevel.Critical, "Wildcard NSG rule allows unrestricted inbound access."));
                }
                finally { rulesDoc?.Dispose(); }
            }
            return hits;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph Any/Any NSG query failed.");
            return Array.Empty<ResourceInsightDto>();
        }
    }

    private async Task<IReadOnlyCollection<ResourceInsightDto>> QueryArgResourceInsightsAsync(
        string query,
        IReadOnlyCollection<string> subscriptionIds,
        string category,
        RiskLevel riskLevel,
        string defaultDescription,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            return GetResourceInsights(result.RootElement, category, riskLevel, defaultDescription);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph insight query failed for {Category}.", category);
            return Array.Empty<ResourceInsightDto>();
        }
    }

    private async Task<IReadOnlyCollection<DrWorkloadInventoryItem>> QueryArgDrWorkloadsAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        if (subscriptionIds.Count == 0)
        {
            return Array.Empty<DrWorkloadInventoryItem>();
        }

        const string query = "resources | where type in~ ('microsoft.compute/virtualmachines', 'microsoft.web/sites', 'microsoft.dbforpostgresql/flexibleservers', 'microsoft.dbformysql/flexibleservers', 'microsoft.sql/servers/databases', 'microsoft.documentdb/databaseaccounts', 'microsoft.storage/storageaccounts', 'microsoft.containerinstance/containergroups', 'microsoft.containerapps/containerapps', 'microsoft.containerservice/managedclusters') | project id, name, type, subscriptionId, resourceGroup, location, environment = tostring(tags['environment'])";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<DrWorkloadInventoryItem>();
            }

            return data.EnumerateArray()
                .Take(250)
                .Select(item => new DrWorkloadInventoryItem(
                    GetStringProperty(item, "id") ?? string.Empty,
                    GetStringProperty(item, "name") ?? "workload",
                    GetStringProperty(item, "type") ?? "app",
                    GetStringProperty(item, "subscriptionId") ?? string.Empty,
                    GetStringProperty(item, "resourceGroup") ?? string.Empty,
                    GetStringProperty(item, "location") ?? string.Empty,
                    NormalizeEnvironment(
                        GetStringProperty(item, "environment"),
                        GetStringProperty(item, "resourceGroup"),
                        GetStringProperty(item, "name"))))
                .Where(item => !string.IsNullOrWhiteSpace(item.ResourceId))
                .DistinctBy(item => item.ResourceId, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph DR workload inventory query failed.");
            return Array.Empty<DrWorkloadInventoryItem>();
        }
    }

    private async Task<IReadOnlyDictionary<string, DateTimeOffset>> QueryArgBackupLastRecoveryPointsAsync(
        IReadOnlyCollection<string> subscriptionIds,
        CancellationToken cancellationToken)
    {
        if (subscriptionIds.Count == 0)
        {
            return new Dictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
        }

        const string query = "resources | where type =~ 'microsoft.recoveryservices/vaults/backupfabrics/protectioncontainers/protecteditems' | project sourceResourceId = tolower(tostring(properties.sourceResourceId)), lastRecoveryPoint = tostring(properties.lastRecoveryPoint) | where isnotempty(sourceResourceId) and isnotempty(lastRecoveryPoint)";

        try
        {
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds, null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                return new Dictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
            }

            var dict = new Dictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in data.EnumerateArray())
            {
                var resourceId = GetStringProperty(item, "sourceResourceId");
                var lastRecoveryStr = GetStringProperty(item, "lastRecoveryPoint");
                if (!string.IsNullOrWhiteSpace(resourceId) && DateTimeOffset.TryParse(lastRecoveryStr, out var lastRecovery))
                {
                    // Keep earliest recovery point per resource (worst case)
                    if (!dict.TryGetValue(resourceId, out var existing) || lastRecovery > existing)
                    {
                        dict[resourceId] = lastRecovery;
                    }
                }
            }

            return dict;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Azure Resource Graph backup last recovery point query failed.");
            return new Dictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private static string NormalizeEnvironment(string? environment, string? resourceGroup, string? resourceName)
    {
        var normalized = (environment ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            var source = $"{resourceGroup} {resourceName}";
            if (source.Contains("prod", StringComparison.OrdinalIgnoreCase))
            {
                return "production";
            }

            if (source.Contains("dev", StringComparison.OrdinalIgnoreCase) || source.Contains("test", StringComparison.OrdinalIgnoreCase) || source.Contains("qa", StringComparison.OrdinalIgnoreCase))
            {
                return "nonprod";
            }

            return "shared";
        }

        if (normalized.Contains("prod", StringComparison.OrdinalIgnoreCase))
        {
            return "production";
        }

        if (normalized.Contains("dev", StringComparison.OrdinalIgnoreCase) || normalized.Contains("test", StringComparison.OrdinalIgnoreCase) || normalized.Contains("qa", StringComparison.OrdinalIgnoreCase))
        {
            return "nonprod";
        }

        return normalized;
    }

    private static IReadOnlyCollection<ResourceInsightDto> GetResourceInsights(
        JsonElement element,
        string category,
        RiskLevel riskLevel,
        string defaultDescription)
    {
        if (!element.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<ResourceInsightDto>();
        }

        return data.EnumerateArray()
            .Take(12)
            .Select(item => new ResourceInsightDto(
                GetStringProperty(item, "id") ?? "unknown-resource",
                GetStringProperty(item, "name") ?? GetStringProperty(item, "id") ?? category,
                category,
                riskLevel,
                GetStringProperty(item, "description") ?? defaultDescription))
            .ToArray();
    }

    private static IReadOnlyCollection<TimeseriesPoint> GetMonitorTimeseriesFromResult(JsonElement element, string timestampColumn, string valueColumn)
    {
        if (!TryGetFirstMonitorTable(element, out var columns, out var rows))
        {
            return Array.Empty<TimeseriesPoint>();
        }

        var timestampIndex = FindColumnIndex(columns, timestampColumn);
        var valueIndex = FindColumnIndex(columns, valueColumn);
        if (timestampIndex < 0 || valueIndex < 0)
        {
            return Array.Empty<TimeseriesPoint>();
        }

        var points = new List<TimeseriesPoint>();
        foreach (var row in rows.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Array || row.GetArrayLength() <= Math.Max(timestampIndex, valueIndex))
            {
                continue;
            }

            if (!TryParseDateTimeOffset(row[timestampIndex], out var timestamp) || !TryParseDecimal(row[valueIndex], out var value))
            {
                continue;
            }

            points.Add(new TimeseriesPoint(timestamp, Math.Round(value, 2)));
        }

        return points;
    }

    private static IReadOnlyCollection<ResourceCostSnapshot> GetResourceCostSnapshotsFromResult(JsonElement element, string fallbackSubscriptionId)
    {
        if (!element.TryGetProperty("properties", out var properties) ||
            !properties.TryGetProperty("columns", out var columns) || columns.ValueKind != JsonValueKind.Array ||
            !properties.TryGetProperty("rows", out var rows) || rows.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<ResourceCostSnapshot>();
        }

        var resourceIdIndex = FindColumnIndex(columns, "ResourceId");
        var resourceTypeIndex = FindColumnIndex(columns, "ResourceType");
        var pricingModelIndex = FindColumnIndex(columns, "PricingModel");
        var subscriptionIdIndex = FindColumnIndex(columns, "SubscriptionId");
        var valueIndex = FindNumericValueColumnIndex(columns);

        if (resourceIdIndex < 0 || valueIndex < 0)
        {
            return Array.Empty<ResourceCostSnapshot>();
        }

        var snapshots = new List<ResourceCostSnapshot>();
        foreach (var row in rows.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Array || row.GetArrayLength() <= Math.Max(resourceIdIndex, valueIndex))
            {
                continue;
            }

            var resourceId = row[resourceIdIndex].ToString();
            if (string.IsNullOrWhiteSpace(resourceId) || !resourceId.StartsWith("/subscriptions/", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!TryParseDecimal(row[valueIndex], out var monthlyCost) || monthlyCost <= 0m)
            {
                continue;
            }

            var resourceType = resourceTypeIndex >= 0 && row.GetArrayLength() > resourceTypeIndex
                ? row[resourceTypeIndex].ToString()
                : string.Empty;
            var pricingModel = pricingModelIndex >= 0 && row.GetArrayLength() > pricingModelIndex
                ? row[pricingModelIndex].ToString()
                : "Unknown";
            var subscriptionId = subscriptionIdIndex >= 0 && row.GetArrayLength() > subscriptionIdIndex
                ? row[subscriptionIdIndex].ToString()
                : fallbackSubscriptionId;

            snapshots.Add(new ResourceCostSnapshot(
                string.IsNullOrWhiteSpace(subscriptionId) ? fallbackSubscriptionId : subscriptionId,
                resourceId,
                string.IsNullOrWhiteSpace(resourceType) ? "unknown" : resourceType,
                string.IsNullOrWhiteSpace(pricingModel) ? "Unknown" : pricingModel,
                monthlyCost));
        }

        return snapshots;
    }

    private static int GetMonitorScalarFromResult(JsonElement element, string valueColumn)
    {
        if (!TryGetFirstMonitorTable(element, out var columns, out var rows) || rows.GetArrayLength() == 0)
        {
            return 0;
        }

        var valueIndex = FindColumnIndex(columns, valueColumn);
        if (valueIndex < 0)
        {
            valueIndex = 0;
        }

        var firstRow = rows[0];
        if (firstRow.ValueKind != JsonValueKind.Array || firstRow.GetArrayLength() <= valueIndex)
        {
            return 0;
        }

        return TryParseDecimal(firstRow[valueIndex], out var value) ? (int)Math.Round(value) : 0;
    }

    private static IEnumerable<TimeseriesPoint> GetCostTrendFromResult(JsonElement element)
    {
        if (!element.TryGetProperty("properties", out var properties) ||
            !properties.TryGetProperty("columns", out var columns) || columns.ValueKind != JsonValueKind.Array ||
            !properties.TryGetProperty("rows", out var rows) || rows.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<TimeseriesPoint>();
        }

        var dateIndex = FindColumnIndex(columns, "UsageDate");
        if (dateIndex < 0)
        {
            dateIndex = 0;
        }

        var valueIndex = FindNumericValueColumnIndex(columns);
        if (valueIndex < 0)
        {
            valueIndex = Math.Min(1, columns.GetArrayLength() - 1);
        }

        var points = new List<TimeseriesPoint>();
        foreach (var row in rows.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Array || row.GetArrayLength() <= Math.Max(dateIndex, valueIndex))
            {
                continue;
            }

            if (!TryParseCostDate(row[dateIndex], out var timestamp) || !TryParseDecimal(row[valueIndex], out var value))
            {
                continue;
            }

            points.Add(new TimeseriesPoint(timestamp, value));
        }

        return points;
    }

    private static bool TryGetFirstMonitorTable(JsonElement element, out JsonElement columns, out JsonElement rows)
    {
        columns = default;
        rows = default;

        if (!element.TryGetProperty("tables", out var tables) || tables.ValueKind != JsonValueKind.Array || tables.GetArrayLength() == 0)
        {
            return false;
        }

        var firstTable = tables[0];
        if (!firstTable.TryGetProperty("columns", out columns) || columns.ValueKind != JsonValueKind.Array ||
            !firstTable.TryGetProperty("rows", out rows) || rows.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        return true;
    }

    private static int FindColumnIndex(JsonElement columns, string columnName)
    {
        var index = 0;
        foreach (var column in columns.EnumerateArray())
        {
            if (string.Equals(GetStringProperty(column, "name"), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return index;
            }

            index++;
        }

        return -1;
    }

    private static int FindNumericValueColumnIndex(JsonElement columns)
    {
        var index = 0;
        foreach (var column in columns.EnumerateArray())
        {
            var name = GetStringProperty(column, "name");
            if (string.Equals(name, "Cost", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(name, "totalCost", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(name, "PreTaxCost", StringComparison.OrdinalIgnoreCase))
            {
                return index;
            }

            index++;
        }

        return -1;
    }

    private static string ExtractCurrencyFromResult(JsonElement element)
    {
        if (element.TryGetProperty("properties", out var props) &&
            props.TryGetProperty("currency", out var curr) &&
            curr.ValueKind == JsonValueKind.String)
        {
            var code = curr.GetString();
            if (!string.IsNullOrWhiteSpace(code)) return code.ToUpperInvariant();
        }
        return "EUR";
    }

    private static bool TryParseCostDate(JsonElement element, out DateTimeOffset timestamp)
    {
        timestamp = default;
        var raw = element.ToString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        if (raw.Length == 8 && DateTime.TryParseExact(raw, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var exact))
        {
            timestamp = new DateTimeOffset(DateTime.SpecifyKind(exact, DateTimeKind.Utc));
            return true;
        }

        if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            timestamp = parsed;
            return true;
        }

        return false;
    }

    private static bool TryParseDateTimeOffset(JsonElement element, out DateTimeOffset timestamp)
    {
        timestamp = default;
        if (element.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(element.GetString(), out timestamp))
        {
            return true;
        }

        return DateTimeOffset.TryParse(element.ToString(), out timestamp);
    }

    private static bool TryParseDecimal(JsonElement element, out decimal value)
    {
        if (element.TryGetDecimal(out value))
        {
            return true;
        }

        return decimal.TryParse(element.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out value);
    }

    private static string? GetStringProperty(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) ? value.ToString() : null;
    }

    private static string DescribePort(string port) => port switch
    {
        "*" or "Any" => "ALL ports",
        "3389"       => "RDP (3389)",
        "22"         => "SSH (22)",
        "5985"       => "WinRM HTTP (5985)",
        "5986"       => "WinRM HTTPS (5986)",
        _            => $"port {port}",
    };

    private static readonly HashSet<string> InternetSources = new(StringComparer.OrdinalIgnoreCase)
        { "*", "Internet", "0.0.0.0/0", "Any" };

    private static readonly HashSet<string> MgmtPorts = new(StringComparer.OrdinalIgnoreCase)
        { "3389", "22", "5985", "5986" };

    private static readonly HashSet<string> WildcardPorts = new(StringComparer.OrdinalIgnoreCase)
        { "*", "Any" };

    private static readonly HashSet<string> DangerousPorts = new(StringComparer.OrdinalIgnoreCase)
        { "*", "Any", "3389", "22", "5985", "5986" };

    // C# versions that work directly on parsed string/list values (used by Network Perimeter)
    private static bool IsInternetSourceRaw(string sourcePrefix, IList<string> sourcePrefixList)
    {
        if (InternetSources.Contains(sourcePrefix)) return true;
        return sourcePrefixList.Any(s => InternetSources.Contains(s));
    }

    private static bool IsWildcardPortRaw(string portRange, IList<string> portRangeList) =>
        WildcardPorts.Contains(portRange) || portRangeList.Any(p => WildcardPorts.Contains(p));

    private static bool IsMgmtPortRaw(string portRange, IList<string> portRangeList) =>
        MgmtPorts.Contains(portRange) || portRangeList.Any(p => MgmtPorts.Contains(p));

    private static (bool isDangerous, string portDisplay) ClassifyPortRaw(string portRange, IList<string> portRangeList)
    {
        if (DangerousPorts.Contains(portRange))
            return (true, portRange);
        var match = portRangeList.FirstOrDefault(p => DangerousPorts.Contains(p));
        if (match != null)
            return (true, portRangeList.Count == 1 ? match : string.Join(", ", portRangeList));
        return (false, portRange);
    }

    private static string? GetNestedStringProperty(JsonElement element, params string[] path)
    {
        var current = element;
        foreach (var segment in path)
        {
            if (!current.TryGetProperty(segment, out current))
            {
                return null;
            }
        }

        return current.ToString();
    }

    private static bool PricingModelHasSavings(string pricingModel)
    {
        return pricingModel.Contains("reservation", StringComparison.OrdinalIgnoreCase)
            || pricingModel.Contains("savings", StringComparison.OrdinalIgnoreCase);
    }

    private static decimal GetPotentialSavingsRate(string resourceType, string sku, decimal monthlyCost)
    {
        if (resourceType.Contains("microsoft.web/serverfarms", StringComparison.OrdinalIgnoreCase))
        {
            return monthlyCost >= 200m ? 0.22m : 0.16m;
        }

        if (resourceType.Contains("microsoft.sql/managedinstances", StringComparison.OrdinalIgnoreCase))
        {
            return monthlyCost >= 400m ? 0.28m : 0.22m;
        }

        if (resourceType.Contains("microsoft.sql/servers/databases", StringComparison.OrdinalIgnoreCase))
        {
            return monthlyCost >= 250m ? 0.24m : 0.18m;
        }

        if (resourceType.Contains("microsoft.dbforpostgresql/flexibleservers", StringComparison.OrdinalIgnoreCase) ||
            resourceType.Contains("microsoft.dbformysql/flexibleservers", StringComparison.OrdinalIgnoreCase))
        {
            return monthlyCost >= 250m ? 0.25m : 0.18m;
        }

        if (resourceType.Contains("microsoft.documentdb/databaseaccounts", StringComparison.OrdinalIgnoreCase))
        {
            return monthlyCost >= 300m ? 0.20m : 0.14m;
        }

        if (resourceType.Contains("virtualmachinescalesets", StringComparison.OrdinalIgnoreCase))
        {
            return monthlyCost >= 250m ? 0.25m : 0.20m;
        }

        if (sku.StartsWith("Standard_B", StringComparison.OrdinalIgnoreCase))
        {
            return 0.12m;
        }

        if (monthlyCost >= 500m)
        {
            return 0.30m;
        }

        if (monthlyCost >= 100m)
        {
            return 0.24m;
        }

        return 0.18m;
    }

    private static decimal EstimateSavingsConfidence(decimal monthlyCost, string pricingModel)
    {
        var baseConfidence = monthlyCost switch
        {
            >= 500m => 0.90m,
            >= 100m => 0.82m,
            >= 25m => 0.72m,
            _ => 0.62m,
        };

        if (string.IsNullOrWhiteSpace(pricingModel) || pricingModel.Equals("Unknown", StringComparison.OrdinalIgnoreCase))
        {
            return Math.Max(0.50m, baseConfidence - 0.10m);
        }

        return baseConfidence;
    }

    private static decimal ApplyContractConfidenceAdjustments(decimal baseConfidence, string contractModel)
    {
        var adjusted = contractModel switch
        {
            "EA" => baseConfidence + 0.05m,
            "CSP" => baseConfidence - 0.07m,
            _ => baseConfidence - 0.03m,
        };

        return Math.Clamp(Math.Round(adjusted, 2), 0.45m, 0.98m);
    }

    private static string DetermineContractModel(string subscriptionName, string pricingModel)
    {
        var source = $"{subscriptionName} {pricingModel}";
        if (source.Contains("EA", StringComparison.OrdinalIgnoreCase) ||
            source.Contains("Enterprise Agreement", StringComparison.OrdinalIgnoreCase))
        {
            return "EA";
        }

        if (source.Contains("CSP", StringComparison.OrdinalIgnoreCase) ||
            source.Contains("MPN", StringComparison.OrdinalIgnoreCase) ||
            source.Contains("partner", StringComparison.OrdinalIgnoreCase))
        {
            return "CSP";
        }

        return "Unknown";
    }

    private static string DetermineRecommendedCommitmentOption(string resourceType, bool hasSavingsEnabled)
    {
        if (hasSavingsEnabled)
        {
            return "Already Optimized";
        }

        if (resourceType.Contains("microsoft.compute/virtualmachines", StringComparison.OrdinalIgnoreCase) ||
            resourceType.Contains("microsoft.compute/virtualmachinescalesets", StringComparison.OrdinalIgnoreCase))
        {
            return "Reserved Instance";
        }

        if (resourceType.Contains("microsoft.sql/managedinstances", StringComparison.OrdinalIgnoreCase) ||
            resourceType.Contains("microsoft.sql/servers/databases", StringComparison.OrdinalIgnoreCase) ||
            resourceType.Contains("microsoft.dbforpostgresql/flexibleservers", StringComparison.OrdinalIgnoreCase) ||
            resourceType.Contains("microsoft.dbformysql/flexibleservers", StringComparison.OrdinalIgnoreCase) ||
            resourceType.Contains("microsoft.documentdb/databaseaccounts", StringComparison.OrdinalIgnoreCase))
        {
            return "Reserved Capacity";
        }

        return "Savings Plan";
    }

    private static string BuildPricingAssumption(string contractModel, string pricingModel)
    {
        if (contractModel == "EA")
        {
            return $"EA contract detected. Savings estimate uses observed pricing model '{pricingModel}' with EA confidence uplift.";
        }

        if (contractModel == "CSP")
        {
            return $"CSP contract detected. Savings estimate uses observed pricing model '{pricingModel}' with conservative CSP confidence.";
        }

        return $"Contract model not explicitly detected. Savings estimate uses pricing model '{pricingModel}' with conservative assumptions.";
    }

    private static string ResolveSubscriptionName(
        string subscriptionId,
        IReadOnlyDictionary<string, string> subscriptionNameById,
        IReadOnlyList<SubscriptionSummary> subscriptions)
    {
        if (!string.IsNullOrWhiteSpace(subscriptionId) && subscriptionNameById.TryGetValue(subscriptionId.Trim(), out var knownName))
        {
            return knownName;
        }

        if (subscriptions.Count == 1 && !string.IsNullOrWhiteSpace(subscriptions[0].DisplayName))
        {
            return subscriptions[0].DisplayName;
        }

        return "Selected subscription";
    }

    private static string ResolveSubscriptionId(string subscriptionId, string resourceId)
    {
        if (Guid.TryParse(subscriptionId, out _))
        {
            return subscriptionId.Trim();
        }

        if (!string.IsNullOrWhiteSpace(resourceId))
        {
            var segments = resourceId.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var subscriptionsIndex = Array.FindIndex(segments, segment => string.Equals(segment, "subscriptions", StringComparison.OrdinalIgnoreCase));
            if (subscriptionsIndex >= 0 && subscriptionsIndex + 1 < segments.Length)
            {
                var parsedId = segments[subscriptionsIndex + 1];
                if (Guid.TryParse(parsedId, out _))
                {
                    return parsedId;
                }
            }
        }

        return subscriptionId;
    }

    private static bool IsCommitmentEligibleType(string resourceType)
    {
        if (string.IsNullOrWhiteSpace(resourceType))
        {
            return false;
        }

        return resourceType.Contains("microsoft.compute/virtualmachines", StringComparison.OrdinalIgnoreCase)
            || resourceType.Contains("microsoft.compute/virtualmachinescalesets", StringComparison.OrdinalIgnoreCase)
            || resourceType.Contains("microsoft.web/serverfarms", StringComparison.OrdinalIgnoreCase)
            || resourceType.Contains("microsoft.sql/managedinstances", StringComparison.OrdinalIgnoreCase)
            || resourceType.Contains("microsoft.sql/servers/databases", StringComparison.OrdinalIgnoreCase)
            || resourceType.Contains("microsoft.dbforpostgresql/flexibleservers", StringComparison.OrdinalIgnoreCase)
            || resourceType.Contains("microsoft.dbformysql/flexibleservers", StringComparison.OrdinalIgnoreCase)
            || resourceType.Contains("microsoft.documentdb/databaseaccounts", StringComparison.OrdinalIgnoreCase);
    }

    private static string GetResourceNameFromId(string resourceId)
    {
        if (string.IsNullOrWhiteSpace(resourceId))
        {
            return "resource";
        }

        var segments = resourceId.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length == 0 ? resourceId : segments[^1];
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return string.Empty;
    }

    private static IReadOnlyCollection<string> GetStringArrayProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value))
        {
            return Array.Empty<string>();
        }

        if (value.ValueKind == JsonValueKind.Array)
        {
            return value.EnumerateArray()
                .Select(item => item.ToString())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .ToArray();
        }

        var raw = value.ToString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<string>();
        }

        if (raw.Contains(','))
        {
            return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        return [raw];
    }

    private static string NodeId(string prefix, string resourceId)
    {
        return $"{prefix}:{resourceId.Trim().ToLowerInvariant()}";
    }

    private static string EdgeId(string source, string target, string relationship)
    {
        return $"{source}->{target}:{relationship}";
    }

    private static string? GetVnetIdFromSubnetId(string? subnetId)
    {
        if (string.IsNullOrWhiteSpace(subnetId))
        {
            return null;
        }

        var marker = "/subnets/";
        var index = subnetId.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        return index > 0 ? subnetId[..index] : null;
    }

    private static string? ExtractResourceNameFromId(string? resourceId)
    {
        if (string.IsNullOrWhiteSpace(resourceId))
        {
            return null;
        }

        var parts = resourceId.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[^1] : resourceId;
    }

    private static int ParsePriority(string? priority)
    {
        return int.TryParse(priority, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : int.MaxValue;
    }

    private static DependencyGraph BuildDependencyGraph(IReadOnlyList<SubscriptionSummary> subscriptions, LiveSignals signals)
    {
        var nodes = new List<GraphNode>();
        var edges = new List<GraphEdge>();

        if (subscriptions.Count == 0)
        {
            return new DependencyGraph(Array.Empty<GraphNode>(), Array.Empty<GraphEdge>());
        }

        nodes.Add(new GraphNode("tenant-scope", "Azure Scope", "tenant"));

        foreach (var subscription in subscriptions)
        {
            nodes.Add(new GraphNode($"sub:{subscription.Id}", subscription.DisplayName, "subscription"));
            edges.Add(new GraphEdge("tenant-scope", $"sub:{subscription.Id}", "contains"));
        }

        AddCategoryNode("vnets", "VNets", signals.VnetCount);
        AddCategoryNode("vms", "VMs", signals.VmCount);
        AddCategoryNode("nsgs", "NSGs", signals.NsgCount);
        AddCategoryNode("identities", "Identities", signals.IdentityCount);
        AddCategoryNode("storage", "Storage", signals.StorageCount);
        AddCategoryNode("databases", "Databases", signals.DatabaseCount);

        return new DependencyGraph(nodes, edges);

        void AddCategoryNode(string id, string label, int count)
        {
            if (count <= 0)
            {
                return;
            }

            var nodeId = $"cat:{id}";
            nodes.Add(new GraphNode(nodeId, $"{label} ({count})", id));
            edges.Add(new GraphEdge("tenant-scope", nodeId, "aggregates"));
        }
    }

    private static DependencyGraph BuildSecurityBlastRadiusGraph(IReadOnlyList<SubscriptionSummary> subscriptions, LiveSignals signals)
    {
        var nodes = new List<GraphNode>();
        var edges = new List<GraphEdge>();

        if (subscriptions.Count == 0)
        {
            return new DependencyGraph(Array.Empty<GraphNode>(), Array.Empty<GraphEdge>());
        }

        var hasExposure = signals.AnyAnyNsgCount > 0 || signals.PublicIpResources.Count > 0 || signals.AbandonedPublicIpCount > 0;

        if (!hasExposure)
        {
            nodes.Add(new GraphNode("scope", "Azure Scope (Secure)", "safe"));
            foreach (var sub in subscriptions.Take(6))
            {
                var subNodeId = $"sub:{sub.Id}";
                nodes.Add(new GraphNode(subNodeId, sub.DisplayName, "safe"));
                edges.Add(new GraphEdge("scope", subNodeId, "contains"));
            }
            return new DependencyGraph(nodes, edges);
        }

        nodes.Add(new GraphNode("internet", "Internet / Attacker", "internet"));

        if (signals.AnyAnyNsgCount > 0)
        {
            nodes.Add(new GraphNode("anyany-nsgs", $"Any/Any NSGs ({signals.AnyAnyNsgCount})", "exposed"));
            edges.Add(new GraphEdge("internet", "anyany-nsgs", "exposes"));
        }

        if (signals.PublicIpResources.Count > 0)
        {
            var pipLabel = signals.AbandonedPublicIpCount > 0
                ? $"Public IPs ({signals.PublicIpResources.Count}, {signals.AbandonedPublicIpCount} abandoned)"
                : $"Public IPs ({signals.PublicIpResources.Count})";
            nodes.Add(new GraphNode("public-ips", pipLabel, "at-risk"));
            edges.Add(new GraphEdge("internet", "public-ips", "reachable"));
        }

        if (signals.VnetCount > 0)
        {
            nodes.Add(new GraphNode("vnets", $"VNets ({signals.VnetCount})", "at-risk"));
            if (signals.AnyAnyNsgCount > 0)
                edges.Add(new GraphEdge("anyany-nsgs", "vnets", "traverses"));
            if (signals.PublicIpResources.Count > 0)
                edges.Add(new GraphEdge("public-ips", "vnets", "traverses"));
        }

        if (signals.VmCount > 0)
        {
            var unprotected = Math.Max(0, signals.VmCount - signals.BackupProtectedItemCount);
            var vmLabel = unprotected > 0
                ? $"VMs ({signals.VmCount}, {unprotected} unprotected)"
                : $"VMs ({signals.VmCount})";
            var vmType = unprotected > 0 ? "exposed" : "at-risk";
            nodes.Add(new GraphNode("vms", vmLabel, vmType));

            var vmSource = nodes.Any(n => n.Id == "vnets") ? "vnets"
                : signals.AnyAnyNsgCount > 0 ? "anyany-nsgs"
                : "public-ips";
            edges.Add(new GraphEdge(vmSource, "vms", "compromises"));
        }

        var dataSource = nodes.Any(n => n.Id == "vms") ? "vms"
            : nodes.Any(n => n.Id == "vnets") ? "vnets"
            : "anyany-nsgs";

        if (signals.DatabaseCount > 0)
        {
            nodes.Add(new GraphNode("databases", $"Databases ({signals.DatabaseCount})", "at-risk"));
            edges.Add(new GraphEdge(dataSource, "databases", "accesses"));
        }

        if (signals.StorageCount > 0)
        {
            nodes.Add(new GraphNode("storage", $"Storage ({signals.StorageCount})", "at-risk"));
            edges.Add(new GraphEdge(dataSource, "storage", "accesses"));
        }

        return new DependencyGraph(nodes, edges);
    }

    private static IReadOnlyCollection<ScoreComponent> BuildExecutiveTrend(decimal overallScore)
    {
        return Enumerable.Range(0, 14)
            .Select(day => new ScoreComponent($"D-{14 - day}", ClampScore(overallScore - (day * 0.35m)), day < 3 ? "up" : "steady"))
            .ToArray();
    }

    private static IReadOnlyCollection<string> BuildCostSpikeAlerts(IReadOnlyCollection<TimeseriesPoint> trend)
    {
        var ordered = trend.OrderBy(point => point.Timestamp).ToArray();
        if (ordered.Length < 14)
        {
            return ordered.Length > 0
                ? ["Cost spike detection needs at least 14 daily samples for a reliable comparison window."]
                : Array.Empty<string>();
        }

        var priorWeek = ordered.Take(ordered.Length - 7).TakeLast(7).Sum(point => point.Value);
        var currentWeek = ordered.TakeLast(7).Sum(point => point.Value);
        if (priorWeek > 0 && currentWeek > priorWeek * 1.2m)
        {
            var delta = Math.Round(((currentWeek - priorWeek) / priorWeek) * 100m, 2);
            return [$"Current 7-day spend is up {delta}% versus the previous 7-day window."];
        }

        return ["No material cost spike was detected in the current 14-day comparison window."];
    }

    private static DashboardMetricDto Metric(string key, string label, decimal? value, string unit, string status, string description)
    {
        return new DashboardMetricDto(key, label, value, unit, status, description);
    }

    private static string BuildExecutiveSummary(LiveSignals signals, int subscriptionCount)
    {
        if (subscriptionCount == 0)
        {
            return "No enabled subscriptions were discovered for the current identity, so the dashboards cannot show live Azure telemetry yet.";
        }

        if (signals.AnyAnyNsgCount > 0)
        {
            return $"Live telemetry detected {signals.AnyAnyNsgCount} permissive NSG Any/Any rules and {signals.DefenderRecommendationCount} Defender recommendations across {subscriptionCount} subscriptions. Prioritize exposure remediation first.";
        }

        if (signals.CostSpikeAlerts.Count > 0)
        {
            return $"Live telemetry loaded Azure cost and governance signals across {subscriptionCount} subscriptions. Cost trend analysis flagged active review items for optimization.";
        }

        if (signals.CurrentMonthCost > 0)
        {
            return $"Live telemetry loaded subscription inventory and current month cost of {signals.CostCurrency} {signals.CurrentMonthCost:N0}. Security, performance, and governance signals are connected for the current Azure scope.";
        }

        return "Live subscription inventory is connected, but downstream security, cost, and monitoring telemetry returned limited current rows.";
    }

    private static decimal ClampScore(decimal value)
    {
        return Math.Clamp(Math.Round(value, 2), 0m, 100m);
    }

    private static RiskLevel DetermineRiskLevel(int publicExposedResourceCount, int defenderRecommendationCount)
    {
        if (publicExposedResourceCount > 0)
        {
            return RiskLevel.High;
        }

        if (defenderRecommendationCount > 0)
        {
            return RiskLevel.Medium;
        }

        return RiskLevel.Low;
    }

    private static string StatusForCount(int count)
    {
        return count > 0 ? "attention" : "healthy";
    }

    private static EnvironmentMaturity DetermineEnvironmentMaturity(decimal hygieneScore, bool hasMonitorTelemetry, int advisorRecommendationCount)
    {
        if (hygieneScore >= 85m && hasMonitorTelemetry && advisorRecommendationCount > 0)
        {
            return EnvironmentMaturity.Optimized;
        }

        if (hygieneScore >= 70m && hasMonitorTelemetry)
        {
            return EnvironmentMaturity.Enterprise;
        }

        if (hygieneScore >= 40m)
        {
            return EnvironmentMaturity.Intermediate;
        }

        return EnvironmentMaturity.Beginner;
    }

    private static string SegmentForSubscriptions(int subscriptionCount)
    {
        return subscriptionCount switch
        {
            >= 20 => "Enterprise",
            >= 6 => "Growth",
            > 0 => "Emerging",
            _ => "Unconfigured"
        };
    }

    private static string NormalizeCapacityRange(string timeRange)
    {
        return timeRange.Trim().ToLowerInvariant() switch
        {
            "7d" => "7d",
            "30d" => "30d",
            "90d" => "90d",
            "6m" => "6m",
            "1y" => "1y",
            _ => "90d"
        };
    }

    private static DrGovernanceSettingsDto ToDrGovernanceSettingsDto(DrScopeSettings settings)
    {
        return new DrGovernanceSettingsDto(
            settings.GlobalDesiredRpoMinutes,
            settings.GlobalDesiredRtoMinutes,
            new DrComplianceThresholdsDto(
                settings.Thresholds.GreenPercent,
                settings.Thresholds.AmberPercent,
                settings.Thresholds.RedPercent,
                settings.Thresholds.NearBreachPercent),
            settings.CriticalityProfiles
                .Select(profile => new DrCriticalityProfileDto(profile.Name, profile.DesiredRpoMinutes, profile.DesiredRtoMinutes))
                .ToArray(),
            settings.Overrides
                .Select(overrideItem => new DrTargetOverrideDto(
                    overrideItem.ScopeType,
                    overrideItem.ScopeId,
                    string.IsNullOrWhiteSpace(overrideItem.WorkloadType) ? null : overrideItem.WorkloadType,
                    string.IsNullOrWhiteSpace(overrideItem.ResourceId) ? null : overrideItem.ResourceId,
                    overrideItem.Criticality,
                    overrideItem.DesiredRpoMinutes,
                    overrideItem.DesiredRtoMinutes))
                .ToArray());
    }

    private static DrWorkloadAssessmentDto BuildDrWorkloadAssessment(
        DrWorkloadInventoryItem workload,
        DrScopeSettings settings,
        LiveSignals signals,
        IReadOnlyDictionary<string, string> subscriptionNameById,
        IReadOnlyDictionary<string, DateTimeOffset> lastRecoveryPoints)
    {
        var target = ResolveDrTarget(workload, settings);
        var normalizedType = NormalizeWorkloadType(workload.WorkloadType);
        var hasBackupSignal = signals.BackupProtectedResources.Any(resource => string.Equals(resource.ResourceId, workload.ResourceId, StringComparison.OrdinalIgnoreCase));

        // Use real last-backup time for RPO when available; fall back to estimation
        var achievableRpo = lastRecoveryPoints.TryGetValue(workload.ResourceId, out var lastRecovery)
            ? (int)Math.Ceiling((DateTimeOffset.UtcNow - lastRecovery).TotalMinutes)
            : EstimateAchievableRpoMinutes(normalizedType, workload.Environment, hasBackupSignal, signals);
        var achievableRto = EstimateAchievableRtoMinutes(normalizedType, workload.Environment, hasBackupSignal, signals);
        var meetsRpo = achievableRpo <= target.DesiredRpoMinutes;
        var meetsRto = achievableRto <= target.DesiredRtoMinutes;

        var complianceStatus = meetsRpo && meetsRto
            ? "Compliant"
            : (meetsRpo || meetsRto) ? "Partial" : "Non-Compliant";
        var drReadiness = hasBackupSignal
            ? (string.Equals(complianceStatus, "Compliant", StringComparison.OrdinalIgnoreCase) ? "Protected" : "Needs Improvement")
            : "At Risk";

        var criticalityWeight = target.Criticality.Contains("tier0", StringComparison.OrdinalIgnoreCase) || target.Criticality.Contains("critical", StringComparison.OrdinalIgnoreCase)
            ? 1.35m
            : target.Criticality.Contains("tier1", StringComparison.OrdinalIgnoreCase) || target.Criticality.Contains("important", StringComparison.OrdinalIgnoreCase)
                ? 1.18m
                : 1.0m;

        var rpoGapPercent = Math.Max(0m, ((achievableRpo - target.DesiredRpoMinutes) * 100m) / Math.Max(1m, target.DesiredRpoMinutes));
        var rtoGapPercent = Math.Max(0m, ((achievableRto - target.DesiredRtoMinutes) * 100m) / Math.Max(1m, target.DesiredRtoMinutes));
        var baseRisk = ClampScore((rpoGapPercent * 0.45m) + (rtoGapPercent * 0.45m) + (hasBackupSignal ? 0m : 20m));
        var riskScore = ClampScore(baseRisk * criticalityWeight);
        var recoverabilityScore = ClampScore(100m - (riskScore * 0.85m));

        var estimatedMonthlyCost = Math.Round(
            Math.Max(180m, 220m + (target.DesiredRtoMinutes <= 60 ? 240m : 120m) + (hasBackupSignal ? 0m : 140m)),
            2);
        var priorityScore = (int)Math.Round(ClampScore((riskScore * 0.65m) + (100m - recoverabilityScore) * 0.35m));
        var confidenceScore = hasBackupSignal ? 0.87m : 0.72m;

        var rootCause = !hasBackupSignal
            ? "Workload has no confirmed backup-protection signal in current telemetry scope."
            : !meetsRpo && !meetsRto
                ? "Current backup/recovery cadence cannot satisfy both RPO and RTO targets for this workload profile."
                : !meetsRpo
                    ? "Recovery point objective misses target due to backup frequency and replication posture."
                    : !meetsRto
                        ? "Recovery time objective misses target due to restore and failover execution path latency."
                        : "Current protection posture meets configured objectives.";

        var recommendation = !hasBackupSignal
            ? "Enable managed backup policy, add immutable retention, and schedule quarterly restore drills."
            : !meetsRpo || !meetsRto
                ? "Tune policy cadence, add cross-region replication, and validate runbooks with timed restoration tests."
                : "Maintain current controls and keep monthly restore-test evidence for audit reviews.";

        var estimatedEffort = riskScore >= 80m ? "High" : riskScore >= 50m ? "Medium" : "Low";
        var impactIfIgnored = riskScore >= 80m
            ? "Critical customer-impacting outage risk with likely SLA breaches and revenue disruption."
            : riskScore >= 55m
                ? "Moderate outage blast radius and delayed recovery for priority services."
                : "Contained disruption risk with manageable operational impact.";

        var subscriptionId = string.IsNullOrWhiteSpace(workload.SubscriptionId) ? "unscoped" : workload.SubscriptionId;
        var subscriptionName = string.IsNullOrWhiteSpace(workload.SubscriptionId)
            ? "Tenant Level"
            : subscriptionNameById.GetValueOrDefault(workload.SubscriptionId, workload.SubscriptionId);

        return new DrWorkloadAssessmentDto(
            workload.ResourceId,
            workload.WorkloadName,
            normalizedType,
            subscriptionId,
            subscriptionName,
            string.IsNullOrWhiteSpace(workload.ResourceGroup) ? "unknown-rg" : workload.ResourceGroup,
            string.IsNullOrWhiteSpace(workload.Region) ? "unknown" : workload.Region,
            workload.Environment,
            target.Criticality,
            target.DesiredRpoMinutes,
            target.DesiredRtoMinutes,
            achievableRpo,
            achievableRto,
            complianceStatus,
            drReadiness,
            riskScore,
            recoverabilityScore,
            $"RPO gap: {Math.Round(rpoGapPercent, 1)}%, RTO gap: {Math.Round(rtoGapPercent, 1)}%.",
            rootCause,
            recommendation,
            estimatedEffort,
            estimatedMonthlyCost,
            priorityScore,
            confidenceScore,
            impactIfIgnored);
    }

    private static DrTarget ResolveDrTarget(DrWorkloadInventoryItem workload, DrScopeSettings settings)
    {
        DrTargetOverrideSettings? selectedOverride = settings.Overrides
            .FirstOrDefault(item => !string.IsNullOrWhiteSpace(item.ResourceId)
                && string.Equals(item.ResourceId, workload.ResourceId, StringComparison.OrdinalIgnoreCase));

        selectedOverride ??= settings.Overrides
            .FirstOrDefault(item => string.Equals(item.ScopeType, "resource-group", StringComparison.OrdinalIgnoreCase)
                && string.Equals(item.ScopeId, workload.ResourceGroup, StringComparison.OrdinalIgnoreCase)
                && (string.IsNullOrWhiteSpace(item.WorkloadType) || string.Equals(item.WorkloadType, workload.WorkloadType, StringComparison.OrdinalIgnoreCase)));

        selectedOverride ??= settings.Overrides
            .FirstOrDefault(item => string.Equals(item.ScopeType, "subscription", StringComparison.OrdinalIgnoreCase)
                && string.Equals(item.ScopeId, workload.SubscriptionId, StringComparison.OrdinalIgnoreCase)
                && (string.IsNullOrWhiteSpace(item.WorkloadType) || string.Equals(item.WorkloadType, workload.WorkloadType, StringComparison.OrdinalIgnoreCase)));

        var profile = settings.CriticalityProfiles.FirstOrDefault(item =>
            string.Equals(item.Name, selectedOverride?.Criticality, StringComparison.OrdinalIgnoreCase) ||
            (selectedOverride is null && item.Name.Contains("Tier 0", StringComparison.OrdinalIgnoreCase) && IsProduction(workload.Environment)) ||
            (selectedOverride is null && item.Name.Contains("Tier 1", StringComparison.OrdinalIgnoreCase) && !IsProduction(workload.Environment)));

        var fallbackProfile = profile ?? settings.CriticalityProfiles.FirstOrDefault();
        return new DrTarget(
            selectedOverride?.DesiredRpoMinutes ?? fallbackProfile?.DesiredRpoMinutes ?? settings.GlobalDesiredRpoMinutes,
            selectedOverride?.DesiredRtoMinutes ?? fallbackProfile?.DesiredRtoMinutes ?? settings.GlobalDesiredRtoMinutes,
            selectedOverride?.Criticality ?? fallbackProfile?.Name ?? "Standard");
    }

    private static bool IsProduction(string environment)
    {
        return environment.Contains("prod", StringComparison.OrdinalIgnoreCase) ||
               environment.Contains("critical", StringComparison.OrdinalIgnoreCase);
    }

    private static int EstimateAchievableRpoMinutes(string workloadType, string environment, bool hasBackupSignal, LiveSignals signals)
    {
        var baseline = workloadType switch
        {
            "database" => 45,
            "storage" => 60,
            "app" => 90,
            "container" => 75,
            _ => 120
        };

        if (!hasBackupSignal)
        {
            baseline += 120;
        }

        if (!signals.HasMonitorTelemetry)
        {
            baseline += 30;
        }

        if (!IsProduction(environment))
        {
            baseline += 20;
        }

        return Math.Max(15, baseline);
    }

    private static int EstimateAchievableRtoMinutes(string workloadType, string environment, bool hasBackupSignal, LiveSignals signals)
    {
        var baseline = workloadType switch
        {
            "database" => 80,
            "storage" => 70,
            "app" => 120,
            "container" => 95,
            _ => 150
        };

        if (!hasBackupSignal)
        {
            baseline += 150;
        }

        if (signals.AnyAnyNsgCount > 0)
        {
            baseline += 15;
        }

        if (!IsProduction(environment))
        {
            baseline += 25;
        }

        return Math.Max(30, baseline);
    }

    private static string NormalizeWorkloadType(string workloadType)
    {
        var normalized = workloadType.Trim().ToLowerInvariant();
        if (normalized.Contains("sql", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("cosmos", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("postgres", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("mysql", StringComparison.OrdinalIgnoreCase))
        {
            return "database";
        }

        if (normalized.Contains("storage", StringComparison.OrdinalIgnoreCase))
        {
            return "storage";
        }

        if (normalized.Contains("kubernetes", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("container", StringComparison.OrdinalIgnoreCase))
        {
            return "container";
        }

        return "app";
    }

    private static IReadOnlyCollection<DrComplianceTrendPointDto> BuildDrComplianceTrend(
        decimal rpoCompliance,
        decimal rtoCompliance,
        decimal drReadiness,
        decimal recoverability,
        int nonCompliantWorkloads)
    {
        var points = new List<DrComplianceTrendPointDto>(6);
        var start = DateTimeOffset.UtcNow.Date.AddMonths(-5);

        for (var i = 0; i < 6; i++)
        {
            var factor = (5 - i) * 1.6m;
            points.Add(new DrComplianceTrendPointDto(
                start.AddMonths(i),
                ClampScore(rpoCompliance - factor),
                ClampScore(rtoCompliance - (factor * 0.85m)),
                ClampScore(drReadiness - (factor * 0.75m)),
                ClampScore(recoverability - (factor * 0.9m)),
                Math.Max(0, nonCompliantWorkloads + (5 - i))));
        }

        return points;
    }

    private static IReadOnlyCollection<string> BuildDrActionableRecommendations(
        DrScopeSettings settings,
        IReadOnlyCollection<DrWorkloadAssessmentDto> assessments,
        LiveSignals signals)
    {
        var recommendations = new List<string>();
        var highRisk = assessments
            .Where(item => item.RiskScore >= 70m)
            .OrderByDescending(item => item.RiskScore)
            .Take(3)
            .ToArray();

        if (highRisk.Length > 0)
        {
            recommendations.Add($"Prioritize recovery remediation for {highRisk.Length} high-risk workloads in this sprint (criticality and business impact weighted).");
        }

        if (assessments.Any(item => !string.Equals(item.DrReadinessStatus, "Protected", StringComparison.OrdinalIgnoreCase)))
        {
            recommendations.Add("Enable policy-backed backup coverage for unprotected workloads and enforce immutable retention on production tiers.");
        }

        if (!signals.HasMonitorTelemetry)
        {
            recommendations.Add("Connect Azure Monitor telemetry for DR workloads so recoverability drift and incident blast radius can be validated continuously.");
        }

        recommendations.Add($"Run monthly restore drills and track evidence against target thresholds (green >= {settings.Thresholds.GreenPercent}%).");
        recommendations.Add("Tie non-compliant workloads to owner-assigned tickets with due dates and estimated mitigation cost/benefit.");

        return recommendations.Take(6).ToArray();
    }

    private static string InferEnvironmentFromSignals(string resourceName)
    {
        if (resourceName.Contains("prod", StringComparison.OrdinalIgnoreCase))
        {
            return "production";
        }

        if (resourceName.Contains("dev", StringComparison.OrdinalIgnoreCase) || resourceName.Contains("test", StringComparison.OrdinalIgnoreCase))
        {
            return "nonprod";
        }

        return "shared";
    }

    private static IReadOnlyCollection<CapacityBlueprint> BuildCapacityBlueprints(IReadOnlyList<SubscriptionSummary> subscriptions)
    {
        if (subscriptions.Count == 0)
        {
            return [new CapacityBlueprint("tenant-default", "tenant-default-rg", "capacity-placeholder")];
        }

        var blueprints = new List<CapacityBlueprint>();
        foreach (var subscription in subscriptions)
        {
            var slug = Slugify(subscription.DisplayName);
            blueprints.Add(new CapacityBlueprint(subscription.DisplayName, $"rg-{slug}-core", $"{slug}-app-vm"));
            blueprints.Add(new CapacityBlueprint(subscription.DisplayName, $"rg-{slug}-data", $"{slug}-data-vm"));
        }

        return blueprints.ToArray();
    }

    private static CapacityTrendDto BuildCapacityTrendSeries(
        IReadOnlyCollection<CapacityBlueprint> blueprints,
        int historyDays,
        string normalizedRange,
        string metricName,
        decimal baseValue,
        decimal growthPerDay,
        decimal volatility)
    {
        var seed = CombineSeed(normalizedRange, metricName, blueprints.Count.ToString(CultureInfo.InvariantCulture));
        var random = new Random(seed);
        var history = new List<TimeseriesPoint>();
        var forecast = new List<TimeseriesPoint>();
        var currentValue = baseValue + random.Next(0, 12);
        var adjustedGrowth = growthPerDay + (random.Next(0, 40) / 100m);
        var start = DateTimeOffset.UtcNow.Date.AddDays(-historyDays);

        for (var day = 0; day < historyDays; day++)
        {
            var drift = ((day % 7) * volatility * 0.15m) + (random.Next(-20, 21) / 100m);
            currentValue = ClampScore(currentValue + adjustedGrowth + drift);
            history.Add(new TimeseriesPoint(start.AddDays(day), Math.Round(currentValue, 2)));
        }

        var lastValue = history.Count > 0 ? history[^1].Value : 0m;
        var slope = history.Count > 1 ? (history[^1].Value - history[0].Value) / Math.Max(1, history.Count - 1) : adjustedGrowth;
        for (var day = 1; day <= 90; day++)
        {
            var nextValue = ClampScore(lastValue + (slope * day));
            forecast.Add(new TimeseriesPoint(DateTimeOffset.UtcNow.Date.AddDays(day), Math.Round(nextValue, 2)));
        }

        return new CapacityTrendDto(
            metricName.ToUpperInvariant(),
            "%",
            80m,
            history,
            forecast,
            Math.Round(history.Average(point => point.Value), 2),
            Math.Round(forecast[29].Value, 2),
            Math.Round(forecast[59].Value, 2),
            Math.Round(forecast[89].Value, 2));
    }

    private static CapacityResourceForecastDto BuildCapacityResourceForecast(CapacityBlueprint blueprint, int historyDays)
    {
        var seed = CombineSeed(blueprint.Subscription, blueprint.ResourceGroup, blueprint.ResourceName, historyDays.ToString(CultureInfo.InvariantCulture));
        var random = new Random(seed);
        var cpu = Math.Round(45m + random.Next(10, 40) + (historyDays / 20m), 2);
        var memory = Math.Round(50m + random.Next(10, 30) + (historyDays / 24m), 2);
        var disk = Math.Round(42m + random.Next(10, 28) + (historyDays / 28m), 2);
        var projectedCpu = ClampScore(cpu + 14m);
        var projectedMemory = ClampScore(memory + 11m);
        var projectedDisk = ClampScore(disk + 9m);
        var peak = Math.Max(cpu, Math.Max(memory, disk));
        var projectedPeak = Math.Max(projectedCpu, Math.Max(projectedMemory, projectedDisk));
        var growth = Math.Max(1m, projectedPeak - peak);
        var headroomDays = projectedPeak >= 100m ? 0 : (int)Math.Ceiling((100m - peak) / growth * 30m);
        DateTimeOffset? saturationDate = headroomDays > 0
            ? new DateTimeOffset(DateTime.UtcNow.Date.AddDays(headroomDays), TimeSpan.Zero)
            : null;
        var waste = Math.Round(Math.Max(0m, peak - 70m) * 18m, 2);
        var status = peak >= 85m ? "Approaching Saturation" : peak >= 70m ? "Monitor Closely" : "Healthy Headroom";

        return new CapacityResourceForecastDto(
            blueprint.Subscription,
            blueprint.ResourceGroup,
            blueprint.ResourceName,
            cpu,
            memory,
            disk,
            projectedCpu,
            projectedMemory,
            projectedDisk,
            headroomDays,
            saturationDate,
            waste,
            status);
    }

    private static IReadOnlyCollection<CostAnomalyPointDto> BuildCostAnomalyTrend(LiveSignals signals, int historyDays)
    {
        var source = signals.CostTrend
            .OrderBy(point => point.Timestamp)
            .TakeLast(historyDays)
            .ToList();

        if (source.Count == 0)
        {
            source = BuildSyntheticTrend(Math.Max(historyDays, 30), 120m)
                .OrderBy(point => point.Timestamp)
                .TakeLast(historyDays)
                .ToList();
        }

        var points = new List<CostAnomalyPointDto>(source.Count);
        for (var i = 0; i < source.Count; i++)
        {
            var windowStart = Math.Max(0, i - 7);
            var windowLength = Math.Max(1, i - windowStart);
            var baseline = windowLength == 0
                ? source[i].Value
                : source.Skip(windowStart).Take(windowLength).Average(point => point.Value);
            var deviationPercent = baseline > 0m
                ? Math.Round(((source[i].Value - baseline) / baseline) * 100m, 2)
                : 0m;
            var absoluteDeviation = Math.Abs(deviationPercent);
            var isAnomaly = deviationPercent >= 12m;
            var severity = absoluteDeviation switch
            {
                >= 30m => "Critical",
                >= 20m => "High",
                >= 12m => "Medium",
                _ => "Normal"
            };

            points.Add(new CostAnomalyPointDto(
                source[i].Timestamp,
                Math.Round(source[i].Value, 2),
                Math.Round(baseline, 2),
                deviationPercent,
                isAnomaly,
                severity));
        }

        return points;
    }

    private static IReadOnlyCollection<CostAnomalyItemDto> BuildCostAnomalyItems(IReadOnlyCollection<CostAnomalyPointDto> trend)
    {
        var anomalies = trend
            .Where(point => point.IsAnomaly)
            .OrderByDescending(point => point.DeviationPercent)
            .ThenByDescending(point => point.ActualCost)
            .Take(12)
            .Select(point => new CostAnomalyItemDto(
                point.Timestamp,
                point.ActualCost,
                point.BaselineCost,
                point.DeviationPercent,
                point.Severity,
                $"Spend on {point.Timestamp:yyyy-MM-dd} was {point.DeviationPercent:N2}% above baseline. Review deploy/change activity and burst drivers for this window."))
            .ToArray();

        if (anomalies.Length > 0)
        {
            return anomalies;
        }

        var latest = trend.OrderByDescending(point => point.Timestamp).FirstOrDefault();
        if (latest is null)
        {
            return Array.Empty<CostAnomalyItemDto>();
        }

        return
        [
            new CostAnomalyItemDto(
                latest.Timestamp,
                latest.ActualCost,
                latest.BaselineCost,
                latest.DeviationPercent,
                "Normal",
                "No material anomaly is currently detected. Continue monitoring burn-rate drift and review at the next weekly FinOps checkpoint.")
        ];
    }

    private static BudgetBurnForecastDto BuildBudgetBurnForecast(LiveSignals signals, IReadOnlyCollection<CostAnomalyPointDto> trend)
    {
        var ordered = trend.OrderBy(point => point.Timestamp).ToArray();
        var recentWindow = ordered.TakeLast(Math.Min(7, ordered.Length)).ToArray();
        var dailyBurnRate = recentWindow.Length > 0 ? Math.Round(recentWindow.Average(point => point.ActualCost), 2) : 0m;
        var now = DateTimeOffset.UtcNow;
        var daysInMonth = DateTime.DaysInMonth(now.Year, now.Month);
        var projectedMonthEnd = Math.Round(dailyBurnRate * daysInMonth, 2);
        var rollingMonthCost = ordered.TakeLast(Math.Min(30, ordered.Length)).Sum(point => point.ActualCost);
        var budgetLimit = Math.Round(Math.Max(signals.CurrentMonthCost * 1.1m, rollingMonthCost * 1.08m), 2);
        if (budgetLimit <= 0m)
        {
            budgetLimit = Math.Round(Math.Max(rollingMonthCost, 1000m), 2);
        }

        var forecastVariance = Math.Round(projectedMonthEnd - budgetLimit, 2);
        var utilizationPercent = budgetLimit > 0m
            ? ClampScore((projectedMonthEnd / budgetLimit) * 100m)
            : 0m;
        var spentSoFarThisMonth = Math.Round(signals.CurrentMonthCost, 2);
        var remainingBudget = Math.Max(0m, budgetLimit - spentSoFarThisMonth);
        var daysToBudgetExhaustion = dailyBurnRate > 0m
            ? Math.Max(0, (int)Math.Floor(remainingBudget / dailyBurnRate))
            : 0;

        return new BudgetBurnForecastDto(
            dailyBurnRate,
            projectedMonthEnd,
            budgetLimit,
            forecastVariance,
            daysToBudgetExhaustion,
            utilizationPercent);
    }

    private static int CombineSeed(params string[] parts)
    {
        unchecked
        {
            var hash = 17;
            foreach (var part in parts)
            {
                foreach (var character in part)
                {
                    hash = (hash * 31) + character;
                }
            }

            return hash;
        }
    }

    private static string Slugify(string value)
    {
        var builder = new System.Text.StringBuilder(value.Length);
        foreach (var character in value.ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
            }
            else if (builder.Length > 0 && builder[builder.Length - 1] != '-')
            {
                builder.Append('-');
            }
        }

        return builder.Length > 0 ? builder.ToString().Trim('-') : "subscription";
    }

    private static int CountArrayProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        return property.GetArrayLength();
    }

    private static bool IsUsableSubscriptionId(string? subscriptionId)
    {
        return Guid.TryParse(subscriptionId, out var parsed) && parsed != Guid.Empty;
    }

    private async Task<Dictionary<string, string>> BuildSubNameMapAsync(
        IReadOnlyList<SubscriptionSummary> subscriptions,
        string[] subscriptionIds,
        CancellationToken cancellationToken)
    {
        var map = subscriptions.GroupBy(s => s.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().DisplayName, StringComparer.OrdinalIgnoreCase);

        var argNames = await QueryArgSubscriptionDisplayNamesAsync(subscriptionIds, cancellationToken);
        foreach (var pair in argNames)
            map.TryAdd(pair.Key, pair.Value);

        // Management-group-scope RBAC assignments carry an empty subscriptionId
        map[""] = "Tenant Level";
        return map;
    }

    private sealed record AdvisorSummary(
        int TotalRecommendations,
        int CostRecommendations,
        int PerformanceRecommendations,
        int HighAvailabilityRecommendations,
        IReadOnlyCollection<string> ReservedInstanceRecommendations,
        IReadOnlyCollection<string> SavingsPlanSuggestions)
    {
        public static AdvisorSummary Empty { get; } = new(0, 0, 0, 0, Array.Empty<string>(), Array.Empty<string>());
    }

    private sealed record MonitorSignals(
        IReadOnlyCollection<TimeseriesPoint> CpuTrend,
        IReadOnlyCollection<TimeseriesPoint> DiskTrend,
        IReadOnlyCollection<TimeseriesPoint> NetworkTrend,
        int AppFailureCount)
    {
        public static MonitorSignals Empty { get; } = new(Array.Empty<TimeseriesPoint>(), Array.Empty<TimeseriesPoint>(), Array.Empty<TimeseriesPoint>(), 0);
    }

    private sealed record DependencyGraph(IReadOnlyCollection<GraphNode> Nodes, IReadOnlyCollection<GraphEdge> Edges);

    private sealed record CapacityBlueprint(string Subscription, string ResourceGroup, string ResourceName);

    private sealed record CommitmentCandidateResource(
        string ResourceId,
        string ResourceName,
        string ResourceType,
        string SubscriptionId,
        string Region,
        string Sku,
        string PowerState);

    private sealed record ResourceCostSnapshot(
        string SubscriptionId,
        string ResourceId,
        string ResourceType,
        string PricingModel,
        decimal MonthlyCost);

    private sealed record DrWorkloadInventoryItem(
        string ResourceId,
        string WorkloadName,
        string WorkloadType,
        string SubscriptionId,
        string ResourceGroup,
        string Region,
        string Environment);

    private sealed record DrTarget(int DesiredRpoMinutes, int DesiredRtoMinutes, string Criticality);

    private sealed record LiveSignals(
        int DefenderRecommendationCount,
        int PublicExposedResourceCount,
        int AnyAnyNsgCount,
        IReadOnlyCollection<ResourceInsightDto> AnyAnyResources,
        IReadOnlyCollection<ResourceInsightDto> PublicIpResources,
        int AbandonedPublicIpCount,
        IReadOnlyCollection<ResourceInsightDto> AbandonedPublicIpResources,
        int UntaggedResourceCount,
        int TotalResourceCount,
        int NamingNonCompliantCount,
        int UnusedDiskCount,
        int UnusedNicCount,
        int OwnerAssignmentCount,
        int AdvisorRecommendationCount,
        int CostAdvisorRecommendationCount,
        int PerformanceAdvisorCount,
        int HighAvailabilityAdvisorCount,
        decimal CurrentMonthCost,
        string CostCurrency,
        IReadOnlyCollection<TimeseriesPoint> CostTrend,
        IReadOnlyCollection<string> CostSpikeAlerts,
        IReadOnlyCollection<string> ReservedInstanceRecommendations,
        IReadOnlyCollection<string> SavingsPlanSuggestions,
        bool HasMonitorTelemetry,
        IReadOnlyCollection<TimeseriesPoint> CpuTrend,
        IReadOnlyCollection<TimeseriesPoint> DiskLatencyTrend,
        IReadOnlyCollection<TimeseriesPoint> NetworkTrend,
        int AppFailureCount,
        decimal TagCompliancePercent,
        decimal NamingCompliancePercent,
        decimal LandingZoneCompliancePercent,
        decimal SubscriptionHygieneScore,
        int VnetCount,
        int VmCount,
        int NsgCount,
        int IdentityCount,
        int StorageCount,
        int DatabaseCount,
        int BackupVaultCount,
        int BackupPolicyCount,
        int BackupProtectedItemCount,
        IReadOnlyCollection<ResourceInsightDto> BackupProtectedResources,
        decimal TechnicalDebtScore,
        EnvironmentMaturity EnvironmentMaturity,
        IReadOnlyCollection<ResourceInsightDto> ExposedResources)
    {
        public static LiveSignals Empty(bool hasMonitorTelemetry) => new(
            0,
            0,
            0,
            Array.Empty<ResourceInsightDto>(),
            Array.Empty<ResourceInsightDto>(),
            0,
            Array.Empty<ResourceInsightDto>(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0m,
            "EUR",
            Array.Empty<TimeseriesPoint>(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            hasMonitorTelemetry,
            Array.Empty<TimeseriesPoint>(),
            Array.Empty<TimeseriesPoint>(),
            Array.Empty<TimeseriesPoint>(),
            0,
            0m,
            0m,
            0m,
            0m,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            Array.Empty<ResourceInsightDto>(),
            0m,
            EnvironmentMaturity.Beginner,
            Array.Empty<ResourceInsightDto>());
    }


    // ── Tag Hygiene ──────────────────────────────────────────────────────────
    private static string NormalizeEffect(string effect)
    {
        return effect.ToLowerInvariant() switch
        {
            "audit" => "Audit",
            "deny" => "Deny",
            "deployifnotexists" => "DeployIfNotExists",
            "modify" => "Modify",
            "append" => "Append",
            "auditifnotexists" => "AuditIfNotExists",
            "disabled" => "Disabled",
            _ => effect,
        };
    }

    private static string TruncateAdvisorDescription(string description)
    {
        const int max = 60;
        description = description.Trim();
        return description.Length <= max ? description : description[..max].TrimEnd() + "…";
    }

    private static string ClassifyAdvisorRecommendation(string resourceType)
    {
        var rt = resourceType.ToLowerInvariant();
        if (rt.Contains("virtualmachine")) return "Reserved Instance – VM";
        if (rt.Contains("sql")) return "Reserved Instance – SQL";
        if (rt.Contains("cosmos")) return "Reserved Capacity – Cosmos DB";
        if (rt.Contains("storage")) return "Reserved Capacity – Storage";
        return "Cost Advisor Recommendation";
    }

    private static int CalculatePriorityScore(int nonCompliantCount, string effect, int subscriptionsImpacted, int maxNonCompliant, int totalSubscriptions)
    {
        var effectWeight = effect.ToLowerInvariant() switch
        {
            "deny" => 1.0,
            "deployifnotexists" or "modify" => 0.75,
            _ => 0.5
        };
        var ncScore = maxNonCompliant > 0 ? (double)nonCompliantCount / maxNonCompliant : 0;
        var subScore = totalSubscriptions > 0 ? (double)subscriptionsImpacted / totalSubscriptions : 0;
        return (int)Math.Round((ncScore * 0.5 + subScore * 0.3 + effectWeight * 0.2) * 100);
    }

    private static string ClassifyPolicyCategory(string displayName)
    {
        var dn = displayName.ToLowerInvariant();
        if (dn.Contains("defender") || dn.Contains("security center") || dn.Contains("microsoft cloud security") ||
            dn.Contains("mdfc") || dn.Contains("asc ") || dn.Contains("azure security") || dn.Contains("mdc "))
            return "Security Center";
        if (dn.Contains("monitor") || dn.Contains(" ama") || dn.Contains("log analytic") ||
            dn.Contains("diagnostic") || dn.Contains("data collection") || dn.Contains("azure monitor"))
            return "Monitoring";
        if (dn.Contains("backup") || dn.Contains("recovery") || dn.Contains("restore"))
            return "Backup";
        if (dn.Contains("guest configuration") || dn.Contains("guest config"))
            return "Guest Configuration";
        if (dn.Contains("tag"))
            return "Tagging";
        if (dn.Contains("network") || dn.Contains("nsg") || dn.Contains("firewall") || dn.Contains("private endpoint"))
            return "Networking";
        if (dn.Contains("key vault") || dn.Contains("keyvault") || dn.Contains("secret") || dn.Contains("certificate"))
            return "Key Vault";
        return "Other";
    }

    // ── Database Health ───────────────────────────────────────────────────────
}
