using NightWatch.Domain.Models;

namespace NightWatch.Application.Contracts;

public enum DataStatus { Live, Synthetic, Unknown }

public sealed record TopCostlyResourceDto(
    string ResourceId,
    string ResourceName,
    string ResourceType,
    string SubscriptionId,
    string SubscriptionName,
    decimal MonthlyCostEur);

public sealed record TopCostlyResourcesDashboardDto(
    string TenantId,
    IReadOnlyCollection<TopCostlyResourceDto> Resources,
    decimal TotalCostEur,
    DateTimeOffset GeneratedAt,
    string Currency = "EUR");

public sealed record SubscriptionMonthCostDto(
    string SubscriptionId,
    string SubscriptionName,
    decimal CostEur);

public sealed record SubscriptionCostMonthDto(
    string Month,
    string MonthLabel,
    decimal TotalCostEur,
    IReadOnlyCollection<SubscriptionMonthCostDto> Subscriptions);

public sealed record SubscriptionCostSummaryDto(
    string SubscriptionId,
    string SubscriptionName,
    decimal TotalCostEur,
    decimal AvgMonthlyCostEur,
    decimal PeakMonthCostEur,
    string PeakMonth);

public sealed record SubscriptionCostDashboardDto(
    string TenantId,
    int Months,
    DateTimeOffset GeneratedAt,
    decimal TotalCostEur,
    decimal AvgMonthlyCostEur,
    decimal CurrentMonthCostEur,
    IReadOnlyCollection<SubscriptionCostMonthDto> MonthlyBreakdown,
    IReadOnlyCollection<SubscriptionCostSummaryDto> SubscriptionSummaries,
    string Currency = "EUR");

public sealed record ExecutiveDashboardDto(
    string TenantId,
    decimal AzureHealthScore,
    decimal SecurityPostureScore,
    decimal PerformanceScore,
    decimal CostEfficiencyScore,
    decimal ReliabilityScore,
    decimal GovernanceComplianceScore,
    string ExecutiveSummary,
    IEnumerable<ScoreComponent> DailyTrend,
    IEnumerable<SubscriptionRiskHeatmapCell> SubscriptionRiskHeatmap,
    decimal BusinessImpactEstimateEur,
    decimal BackupCoveragePercent,
    int TotalStatefulWorkloads,
    int ProtectedWorkloads,
    DataStatus DataStatus = DataStatus.Live);

public sealed record NetworkTopologyDashboardDto(
    string TenantId,
    DateTimeOffset GeneratedAt,
    int VnetCount,
    int PeeringCount,
    int VpnGatewayCount,
    int ConnectionCount,
    int LocalGatewayCount,
    IReadOnlyCollection<NetworkTopologyVnetDto> Vnets,
    IReadOnlyCollection<GraphNode> Nodes,
    IReadOnlyCollection<GraphEdge> Edges,
    IReadOnlyCollection<string> Notes);

public sealed record NetworkTopologyVnetDto(
    string ResourceId,
    string Name,
    string SubscriptionId,
    string SubscriptionName,
    string Location,
    IReadOnlyCollection<string> AddressPrefixes,
    IReadOnlyCollection<string> DnsServers,
    IReadOnlyCollection<string> LinkedPrivateDnsZones,
    IReadOnlyCollection<NetworkTopologySubnetDto> Subnets);

public sealed record NetworkTopologySubnetDto(
    string ResourceId,
    string Name,
    string AddressPrefix,
    string? NetworkSecurityGroupId,
    string? RouteTableId,
    IReadOnlyCollection<NetworkTopologySecurityRuleDto> NsgRules,
    IReadOnlyCollection<NetworkTopologyRouteRuleDto> RouteRules);

public sealed record NetworkTopologySecurityRuleDto(
    string Name,
    string Priority,
    string Direction,
    string Access,
    string Protocol,
    string Source,
    string SourcePort,
    string Destination,
    string DestinationPort);

public sealed record NetworkTopologyRouteRuleDto(
    string Name,
    string AddressPrefix,
    string NextHopType,
    string NextHopIpAddress);

public sealed record SubscriptionRiskHeatmapCell(string SubscriptionId, string SubscriptionName, RiskLevel RiskLevel, decimal ImpactEstimateEur);

public sealed record DashboardMetricDto(string Key, string Label, decimal? Value, string Unit, string Status, string Description);

public sealed record ResourceInsightDto(string ResourceId, string ResourceName, string Category, RiskLevel RiskLevel, string Description);

public sealed record SecurityDashboardDto(
    IEnumerable<SecurityFinding> Findings,
    IEnumerable<GraphNode> BlastRadiusNodes,
    IEnumerable<GraphEdge> BlastRadiusEdges,
    IEnumerable<DashboardMetricDto> Metrics,
    IEnumerable<ResourceInsightDto> ExposedResources,
    IEnumerable<string> CoverageNotes);

public sealed record PerformanceDashboardDto(
    decimal SlaRiskScore,
    IEnumerable<TimeseriesPoint> CpuAnomalies,
    IEnumerable<TimeseriesPoint> DiskLatencyMs,
    IEnumerable<TimeseriesPoint> NetworkBottleneckScore,
    IEnumerable<string> OutagePredictions,
    IEnumerable<DashboardMetricDto> Metrics,
    IEnumerable<string> ServiceHealthSignals,
    IEnumerable<string> RegionalOutageImpacts,
    IEnumerable<GraphNode> DependencyNodes,
    IEnumerable<GraphEdge> DependencyEdges,
    int FragilityIndex,
    string FragilityRating,
    IEnumerable<string> FragilityDrivers);

public sealed record CostDashboardDto(
    decimal PredictedNextMonthCost,
    decimal CurrentMonthCost,
    IEnumerable<Recommendation> Recommendations,
    IEnumerable<TimeseriesPoint> CostTrend,
    decimal CarbonFootprintKgCo2,
    IEnumerable<DashboardMetricDto> Metrics,
    IEnumerable<string> CostSpikeAlerts,
    IEnumerable<string> ReservedInstanceRecommendations,
    IEnumerable<string> SavingsPlanSuggestions,
    string Currency = "EUR");

public sealed record WallOfShameItemDto(
    string ResourceId,
    string ResourceName,
    string ResourceType,
    string SubscriptionName,
    IReadOnlyCollection<string> Violations,
    int ViolationCount);

public sealed record GovernanceDashboardDto(
    decimal TagCompliancePercent,
    decimal NamingCompliancePercent,
    decimal LandingZoneCompliancePercent,
    IEnumerable<string> DriftAlerts,
    IEnumerable<OwnershipInsight> OwnershipInsights,
    IEnumerable<DashboardMetricDto> Metrics,
    IEnumerable<string> LifecycleAlerts,
    IEnumerable<string> BlueprintComparisons,
    IEnumerable<WallOfShameItemDto> WallOfShameItems);

public sealed record OwnershipInsight(string TeamName, int ResourceCount, int UnownedResources);

public sealed record OperationalChangeEventDto(
    DateTimeOffset Timestamp,
    string ResourceId,
    string ResourceName,
    string ChangeType,
    string Description,
    string Category,
    RiskLevel Impact);

public sealed record SmartFeaturesDto(
    IEnumerable<string> WhatChanged,
    IEnumerable<Recommendation> AiRecommendations,
    IEnumerable<GraphNode> RelationshipNodes,
    IEnumerable<GraphEdge> RelationshipEdges,
    IEnumerable<RiskEvent> RiskTimeline,
    decimal TechnicalDebtScore,
    IEnumerable<string> SingleFailurePoints,
    int SuppressedAlerts,
    EnvironmentMaturity EnvironmentMaturityScore,
    IEnumerable<OperationalChangeEventDto> OperationalTimeline);

public sealed record TimeseriesPoint(DateTimeOffset Timestamp, decimal Value);

public sealed record TenantOverviewDto(
    string TenantId,
    string TenantName,
    int SubscriptionCount,
    decimal OverallRiskScore,
    int ActiveCriticalAlerts,
    string Segment,
    decimal SecurityScore,
    decimal CostScore,
    decimal PerformanceScore,
    decimal GovernanceScore);

public sealed record IntegrationCatalogDto(
    string ResourceGraphEndpoint,
    string AzureMonitorEndpoint,
    string DefenderEndpoint,
    string AdvisorEndpoint,
    string CostManagementEndpoint,
    IReadOnlyCollection<string> SampleArgQueries,
    IReadOnlyCollection<string> SampleKqlQueries);

public sealed record CapacityTrendDto(
    string Name,
    string Unit,
    decimal ThresholdPercent,
    IReadOnlyCollection<TimeseriesPoint> History,
    IReadOnlyCollection<TimeseriesPoint> Forecast,
    decimal CurrentAverage,
    decimal Projected30Days,
    decimal Projected60Days,
    decimal Projected90Days);

public sealed record CapacityResourceForecastDto(
    string Subscription,
    string ResourceGroup,
    string ResourceName,
    decimal CpuCurrent,
    decimal MemoryCurrent,
    decimal DiskCurrent,
    decimal ProjectedCpu90,
    decimal ProjectedMemory90,
    decimal ProjectedDisk90,
    int EstimatedHeadroomDays,
    DateTimeOffset? SaturationDate,
    decimal EstimatedMonthlyWaste,
    string Status);

public sealed record CapacityHeadroomDto(
    string ResourceName,
    string Metric,
    DateTimeOffset? SaturationDate,
    int EstimatedHeadroomDays,
    string Status);

public sealed record CapacityRunwayItemDto(
    string ResourceName,
    string ResourceType,
    string Metric,
    int DaysUntilExhaustion,
    decimal CurrentUsagePercent,
    string UrgencyLevel);

public sealed record QuickWinItemDto(
    string ResourceId,
    string ResourceName,
    string ResourceType,
    string SubscriptionName,
    string IssueType,
    decimal EstimatedMonthlySavingsEur,
    string Recommendation,
    string Priority);

public sealed record PropertyChangeDto(
    string PropertyPath,
    string? OldValue,
    string? NewValue);

public sealed record ChangeEventDto(
    string Id,
    DateTimeOffset Timestamp,
    string ChangeType,
    string ResourceId,
    string ResourceName,
    string ResourceType,
    string ResourceGroup,
    string SubscriptionId,
    string ChangedBy,
    string ChangedByType,
    string ClientType,
    string CorrelationId,
    IReadOnlyList<PropertyChangeDto> PropertyChanges);

public sealed record ChangesDashboardDto(
    string TimeRange,
    IReadOnlyList<ChangeEventDto> Changes,
    int TotalCount,
    int CreateCount,
    int UpdateCount,
    int DeleteCount,
    IReadOnlyList<string> TopChangedBy);

public sealed record QuickWinsDashboardDto(
    DateTimeOffset GeneratedAt,
    decimal TotalPotentialSavingsEur,
    int TotalQuickWins,
    IReadOnlyCollection<QuickWinItemDto> Items,
    IReadOnlyCollection<DashboardMetricDto> Metrics);

public sealed record CapacityPlanningDashboardDto(
    string Key,
    string Title,
    string Summary,
    string TimeRange,
    DateTimeOffset GeneratedAt,
    IReadOnlyCollection<DashboardMetricDto> Metrics,
    IReadOnlyCollection<CapacityTrendDto> Trends,
    IReadOnlyCollection<CapacityResourceForecastDto> Resources,
    IReadOnlyCollection<CapacityHeadroomDto> HeadroomTimeline,
    IReadOnlyCollection<string> Recommendations,
    string InsightCallout,
    string ExecutiveRecommendation,
    string OperationalRecommendation,
    string TechnicalRecommendation,
    IReadOnlyCollection<CapacityRunwayItemDto> RunwayForecast);

public sealed record CostAnomalyPointDto(
    DateTimeOffset Timestamp,
    decimal ActualCost,
    decimal BaselineCost,
    decimal DeviationPercent,
    bool IsAnomaly,
    string Severity);

public sealed record CostAnomalyItemDto(
    DateTimeOffset Timestamp,
    decimal ActualCost,
    decimal BaselineCost,
    decimal DeviationPercent,
    string Severity,
    string Insight);

public sealed record BudgetBurnForecastDto(
    decimal DailyBurnRate,
    decimal ProjectedMonthEndCost,
    decimal BudgetLimit,
    decimal ForecastVariance,
    int DaysToBudgetExhaustion,
    decimal BudgetUtilizationPercent);

public sealed record CostAnomalyForecastDashboardDto(
    string Key,
    string Title,
    string Summary,
    string TimeRange,
    DateTimeOffset GeneratedAt,
    IReadOnlyCollection<DashboardMetricDto> Metrics,
    IReadOnlyCollection<CostAnomalyPointDto> Trend,
    IReadOnlyCollection<CostAnomalyItemDto> Anomalies,
    BudgetBurnForecastDto BudgetForecast,
    IReadOnlyCollection<string> Recommendations,
    string InsightCallout,
    string ExecutiveRecommendation,
    string OperationalRecommendation,
    string TechnicalRecommendation,
    string Currency = "EUR");

public sealed record ActionableInsightDto(
    string IssueTitle,
    RiskLevel Severity,
    decimal RiskScore,
    string ImpactedTenant,
    string Subscription,
    string ResourceGroup,
    string ResourceName,
    string ResourceType,
    string Environment,
    string BusinessUnitOrCostCenter,
    DateTimeOffset FirstDetectedTime,
    DateTimeOffset LastDetectedTime,
    string Duration,
    string ImpactAnalysis,
    string RootCauseExplanation,
    string RecommendedRemediation,
    IReadOnlyCollection<string> RemediationSteps,
    decimal EstimatedSavings,
    decimal EstimatedRiskReduction,
    decimal EstimatedPerformanceImprovement,
    string EstimatedOperationalImpact,
    decimal ConfidenceScore,
    IReadOnlyCollection<string> CorrelatedResources,
    IReadOnlyCollection<string> RelatedIncidents,
    IReadOnlyCollection<string> RelatedChanges,
    string ResponsibleOwnerTeam);

public sealed record TimelineEventDto(DateTimeOffset Timestamp, string Category, string Description);

public sealed record HistoricalIntelligenceDto(
    IReadOnlyCollection<TimeseriesPoint> Trend7Days,
    IReadOnlyCollection<TimeseriesPoint> Trend30Days,
    IReadOnlyCollection<TimeseriesPoint> Trend90Days,
    IReadOnlyCollection<TimeseriesPoint> Trend6Months,
    IReadOnlyCollection<TimeseriesPoint> Trend12Months,
    IReadOnlyCollection<TimelineEventDto> TimelineEvents,
    string BaselineComparison,
    string TrendDeviation,
    string RiskEvolution,
    string PredictedOutcomeIfIgnored);

public sealed record PredictiveInsightDto(string ForecastLabel, string Prediction, decimal ConfidenceScore, string TimeHorizon);

public sealed record AuditEvidenceDto(string Reason, string DataSources, string HistoricalEvidence, string CorrelationLogic, string TelemetryReferences);

public sealed record DashboardStructuredSummaryDto(
    string HeadlineStatus,
    IReadOnlyCollection<DashboardMetricDto> KeyMetrics,
    IReadOnlyCollection<string> TopRisks,
    IReadOnlyCollection<string> TopActions,
    IReadOnlyCollection<string> ForecastSignals,
    IReadOnlyCollection<string> EvidenceReferences);

public sealed record RiSavingsOpportunityDto(
    string SubscriptionId,
    string SubscriptionName,
    string RecommendedOption,
    string ContractModel,
    string PricingAssumption,
    string ResourceId,
    string ResourceName,
    string ResourceType,
    string Region,
    string Sku,
    decimal MonthlyCost,
    string PricingModel,
    bool HasSavingsEnabled,
    decimal PotentialMonthlySavings,
    decimal PotentialSavingsPercent,
    decimal ConfidenceScore,
    string Recommendation);

public sealed record StrategicDashboardDto(
    string Key,
    string Title,
    string Summary,
    IEnumerable<DashboardMetricDto> Metrics,
    IReadOnlyCollection<string> Signals,
    IReadOnlyCollection<string> Recommendations,
    RiskLevel Priority,
    DateTimeOffset GeneratedAt,
    IReadOnlyCollection<ActionableInsightDto> ActionableDetails,
    HistoricalIntelligenceDto HistoricalIntelligence,
    IReadOnlyCollection<PredictiveInsightDto> PredictiveInsights,
    AuditEvidenceDto AuditEvidence,
    DashboardStructuredSummaryDto StructuredSummary,
    IReadOnlyCollection<RiSavingsOpportunityDto> RiSavingsOpportunities,
    string ExecutiveRecommendation,
    string OperationalRecommendation,
    string TechnicalRecommendation);

public sealed record ResourceDeepDiveDto(
    string ResourceId,
    string ResourceName,
    string ResourceType,
    decimal HealthScore,
    decimal RiskScore,
    decimal CostScore,
    decimal PerformanceScore,
    decimal SecurityScore,
    IReadOnlyCollection<TimeseriesPoint> CpuTrend,
    IReadOnlyCollection<TimeseriesPoint> MemoryTrend,
    IReadOnlyCollection<TimelineEventDto> ChangeTimeline,
    IReadOnlyCollection<string> SecurityFindings,
    IReadOnlyCollection<string> CostInsights,
    IReadOnlyCollection<string> Recommendations);

public sealed record DrComplianceThresholdsDto(
    decimal GreenPercent,
    decimal AmberPercent,
    decimal RedPercent,
    decimal NearBreachPercent);

public sealed record DrCriticalityProfileDto(
    string Name,
    int DesiredRpoMinutes,
    int DesiredRtoMinutes);

public sealed record DrTargetOverrideDto(
    string ScopeType,
    string ScopeId,
    string? WorkloadType,
    string? ResourceId,
    string Criticality,
    int DesiredRpoMinutes,
    int DesiredRtoMinutes);

public sealed record DrGovernanceSettingsDto(
    int GlobalDesiredRpoMinutes,
    int GlobalDesiredRtoMinutes,
    DrComplianceThresholdsDto Thresholds,
    IReadOnlyCollection<DrCriticalityProfileDto> CriticalityProfiles,
    IReadOnlyCollection<DrTargetOverrideDto> Overrides);

public sealed record DrWorkloadAssessmentDto(
    string WorkloadId,
    string WorkloadName,
    string WorkloadType,
    string SubscriptionId,
    string SubscriptionName,
    string ResourceGroup,
    string Region,
    string Environment,
    string Criticality,
    int DesiredRpoMinutes,
    int DesiredRtoMinutes,
    int AchievableRpoMinutes,
    int AchievableRtoMinutes,
    string ComplianceStatus,
    string DrReadinessStatus,
    decimal RiskScore,
    decimal RecoverabilityScore,
    string GapSummary,
    string RootCause,
    string Recommendation,
    string EstimatedEffort,
    decimal EstimatedMonthlyCostEur,
    int PriorityScore,
    decimal ConfidenceScore,
    string BusinessImpactIfIgnored);

public sealed record DrComplianceTrendPointDto(
    DateTimeOffset Timestamp,
    decimal RpoCompliancePercent,
    decimal RtoCompliancePercent,
    decimal DrReadinessScore,
    decimal RecoverabilityScore,
    int NonCompliantWorkloads);

public sealed record DrSubscriptionRiskDto(
    string SubscriptionId,
    string SubscriptionName,
    int TotalWorkloads,
    int NonCompliantWorkloads,
    decimal RiskScore,
    decimal BusinessImpactExposureEur);

public sealed record DrRiskHeatmapCellDto(
    string Scope,
    string WorkloadType,
    int NonCompliantCount,
    decimal AvgRiskScore);

public sealed record DrDashboardDto(
    string TenantId,
    DateTimeOffset GeneratedAt,
    DrGovernanceSettingsDto GovernanceSettings,
    int TotalWorkloadsAssessed,
    int TotalProtectedWorkloads,
    int TotalUnprotectedWorkloads,
    int WorkloadsMeetingRpo,
    int WorkloadsMeetingRto,
    int WorkloadsFailingCompliance,
    decimal DrReadinessScore,
    decimal RecoverabilityScore,
    decimal BusinessContinuityRiskScore,
    decimal EstimatedBusinessImpactExposureEur,
    decimal RpoCompliancePercent,
    decimal RtoCompliancePercent,
    IReadOnlyCollection<DrRiskHeatmapCellDto> RiskHeatmap,
    IReadOnlyCollection<DrSubscriptionRiskDto> SubscriptionRiskRanking,
    IReadOnlyCollection<DrWorkloadAssessmentDto> TopFailingWorkloads,
    IReadOnlyCollection<DrWorkloadAssessmentDto> WorkloadAssessments,
    IReadOnlyCollection<DrComplianceTrendPointDto> ComplianceTrend,
    IReadOnlyCollection<string> ActionableRecommendations);

// ── Tag Hygiene ──────────────────────────────────────────────────────────────
public sealed record TagHygieneResourceTypeDto(string ResourceType, string ShortType, int UntaggedCount, int TotalCount);
public sealed record TagHygieneSubscriptionDto(string SubscriptionId, string SubscriptionName, int UntaggedCount, int TotalCount, decimal CoveragePercent);
public sealed record TagHygieneDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    decimal CoveragePercent, int TotalResources, int UntaggedResources,
    IReadOnlyCollection<TagHygieneResourceTypeDto> TopUntaggedTypes,
    IReadOnlyCollection<TagHygieneSubscriptionDto> SubscriptionBreakdown);

// ── Orphaned Resources ───────────────────────────────────────────────────────
public sealed record OrphanedResourceDto(string ResourceId, string Name, string ResourceType, string Category, string SubscriptionName, decimal EstimatedMonthlyWasteEur);
public sealed record OrphanedResourcesDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalOrphanedResources, decimal EstimatedMonthlyWasteEur,
    int OrphanedDisks, int OrphanedNics, int OrphanedPublicIps, int OrphanedSnapshots,
    IReadOnlyCollection<OrphanedResourceDto> Resources);


// ── Backup Health ─────────────────────────────────────────────────────────────
public sealed record BackupHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalProtectedItems, int UnprotectedVms, int TotalVms,
    decimal ProtectionCoveragePercent, int BackupVaultCount,
    IReadOnlyCollection<string> UnprotectedResourceTypes);

// ── IAM Review ────────────────────────────────────────────────────────────────
public sealed record IamRiskItemDto(string Title, string RiskLevel, int Count, string Recommendation);
public sealed record IamSubscriptionDto(string SubscriptionName, int TotalAssignments, int OwnerAssignments);
public sealed record IamReviewDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalRoleAssignments, int OwnerAssignments, int ServicePrincipalAssignments, int UserAssignments, int CustomRoleCount,
    IReadOnlyCollection<IamRiskItemDto> Risks,
    IReadOnlyCollection<IamSubscriptionDto> SubscriptionBreakdown);

// ── Wastage Tracker ───────────────────────────────────────────────────────────
public sealed record WastageItemDto(string Category, string ResourceName, string ResourceId, string SubscriptionName, decimal EstimatedMonthlyWasteEur, string Reason);
public sealed record WastageTrackerDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    decimal TotalEstimatedMonthlyWasteEur, int TotalWastedResources,
    IReadOnlyCollection<WastageItemDto> WastageItems,
    string Currency = "EUR");

// ── Network Perimeter ─────────────────────────────────────────────────────────
public sealed record ExposedResourceDto(string ResourceName, string ResourceType, string SubscriptionName, string ExposureType, string RiskLevel, string Details = "");
public sealed record NetworkPerimeterDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalPublicIps, int UnprotectedPublicIps, int OpenManagementPortResources, int DangerousNsgRuleCount,
    IReadOnlyCollection<ExposedResourceDto> ExposedResources);

// ── Non-Prod Uptime Leakage ───────────────────────────────────────────────────
public sealed record NonProdVmDto(string ResourceName, string ResourceId, string SubscriptionName, string Environment, string VmSize, decimal EstimatedMonthlyCostEur);
public sealed record NonProdUptimeDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int NonProdVmCount, int RunningNonProdVmCount,
    decimal EstimatedMonthlyLeakageEur,
    IReadOnlyCollection<NonProdVmDto> RunningVms,
    string Currency = "EUR");

// ── RI & Savings ──────────────────────────────────────────────────────────────
public sealed record RiRecommendationDto(string ResourceType, string RecommendationType, string Term, string Scope, decimal EstimatedAnnualSavingsEur, decimal EstimatedMonthlySavingsEur, string Impact);
public sealed record RiSavingsDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    decimal TotalEstimatedAnnualSavingsEur, decimal TotalEstimatedMonthlySavingsEur, int RecommendationCount,
    IReadOnlyCollection<RiRecommendationDto> Recommendations,
    string Currency = "EUR");

// ── App & Functions Health ────────────────────────────────────────────────────
public sealed record AppFunctionItemDto(string ResourceId, string Name, string Kind, string State, string SubscriptionName, string Location, string Sku);
public sealed record AppFunctionsHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalApps, int RunningApps, int StoppedApps, int FunctionAppCount, int WebAppCount, int LogicAppCount,
    IReadOnlyCollection<AppFunctionItemDto> Apps);

// ── AzPolicyLens ─────────────────────────────────────────────────────────────
public sealed record PolicyCategoryBreakdownDto(string Category, int NonCompliantResources);
public sealed record PolicyAssignmentSummaryDto(
    string AssignmentId, string DisplayName, string Scope, string SubscriptionName,
    int NonCompliantResources, int PriorityScore, int SubscriptionsImpacted, string Effect);
public sealed record PolicySubComplianceDto(
    string SubscriptionId, string SubscriptionName,
    int NonCompliantResources, int CompliantResources, decimal CompliancePercent,
    int ExemptResources, int ConflictResources);
public sealed record PolicyEffectCountDto(string Effect, int Count);
public sealed record AzPolicyLensDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalAssignments, int CustomDefinitions,
    int TotalNonCompliantResources, int TotalCompliantResources, decimal OverallCompliancePercent,
    int TotalExemptions, int CompliantAssignments, int NonCompliantAssignments,
    IReadOnlyCollection<PolicyAssignmentSummaryDto> TopNonCompliantAssignments,
    IReadOnlyCollection<PolicySubComplianceDto> SubscriptionCompliance,
    IReadOnlyCollection<PolicyEffectCountDto> EffectBreakdown,
    IReadOnlyCollection<PolicyCategoryBreakdownDto> CategoryBreakdown);

// ── Database Health ───────────────────────────────────────────────────────────
public sealed record DatabaseResourceDto(
    string ResourceId, string Name, string ResourceType, string DbEngine,
    string SubscriptionName, string Location, string Tier, string Sku,
    string Status, int? DtuCapacity);
public sealed record DatabaseHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalDatabases, int RunningDatabases, int StoppedDatabases,
    int SqlCount, int MySqlCount, int PostgreSqlCount, int CosmosDbCount, int ElasticPoolCount,
    IReadOnlyCollection<DatabaseResourceDto> Databases);

// ── Key Vault Health ──────────────────────────────────────────────────────────
public sealed record KeyVaultItemDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    bool SoftDeleteEnabled, bool PurgeProtectionEnabled, string AccessModel, string Sku);
public sealed record KeyVaultHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalVaults, int SoftDeleteDisabledCount, int PurgeProtectionDisabledCount,
    int AccessPolicyModelCount, int RbacModelCount,
    IReadOnlyCollection<KeyVaultItemDto> Vaults);

// ── AKS & Container Health ────────────────────────────────────────────────────
public sealed record AksClusterDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string KubernetesVersion, string ProvisioningState, int NodeCount, string Sku);
public sealed record ContainerAppItemDto(
    string ResourceId, string Name, string SubscriptionName, string Location, string ProvisioningState);
public sealed record ContainerRegistryItemDto(
    string ResourceId, string Name, string SubscriptionName, string Location, string Sku, bool AdminUserEnabled);
public sealed record AksContainerHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalClusters, int RunningClusters, int StoppedClusters,
    int TotalContainerApps, int TotalRegistries,
    IReadOnlyCollection<AksClusterDto> Clusters,
    IReadOnlyCollection<ContainerAppItemDto> ContainerApps,
    IReadOnlyCollection<ContainerRegistryItemDto> Registries);

// ── Storage Account Compliance ────────────────────────────────────────────────
public sealed record StorageAccountItemDto(
    string ResourceId, string Name, string SubscriptionName, string Location, string Sku,
    bool PublicBlobAccessEnabled, bool HttpsOnly, string MinTlsVersion, bool AllowSharedKeyAccess);
public sealed record StorageComplianceDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalStorageAccounts, int PublicAccessCount, int HttpOnlyViolationCount,
    int WeakTlsCount, int SharedKeyAllowedCount, int FullyCompliantCount,
    IReadOnlyCollection<StorageAccountItemDto> StorageAccounts);

// ── Azure Service Health ──────────────────────────────────────────────────────
public sealed record ServiceHealthEventDto(
    string EventId, string Title, string EventType, string Status,
    string ImpactedService, string SubscriptionName, string Level, DateTimeOffset? StartTime);
public sealed record ServiceHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int ActiveIncidents, int PlannedMaintenance, int HealthAdvisories, int SecurityAdvisories,
    IReadOnlyCollection<ServiceHealthEventDto> Events);

// ── Managed Identity Audit ────────────────────────────────────────────────────
public sealed record ManagedIdentityItemDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string IdentityType, int FederatedCredentialCount);
public sealed record ManagedIdentityAuditDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalUserAssigned, int TotalSystemAssigned,
    IReadOnlyCollection<ManagedIdentityItemDto> UserAssignedIdentities);

// ── Azure Advisor Score ───────────────────────────────────────────────────────
public sealed record AdvisorScoreCategoryDto(string Category, decimal Score, int ImpactedResourceCount, int PotentialScoreIncrease);
public sealed record AdvisorScoreDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    decimal OverallScore,
    IReadOnlyCollection<AdvisorScoreCategoryDto> CategoryScores);

// ── Messaging Health ──────────────────────────────────────────────────────────
public sealed record ServiceBusNamespaceDto(
    string ResourceId, string Name, string SubscriptionName, string Location, string Sku, string Status);
public sealed record EventHubNamespaceDto(
    string ResourceId, string Name, string SubscriptionName, string Location, string Sku, int ThroughputUnits);
public sealed record MessagingHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalServiceBusNamespaces, int TotalEventHubNamespaces,
    IReadOnlyCollection<ServiceBusNamespaceDto> ServiceBusNamespaces,
    IReadOnlyCollection<EventHubNamespaceDto> EventHubNamespaces);

// ── Support Ticket Tracker ────────────────────────────────────────────────────
public sealed record SupportTicketDto(
    string TicketId, string Title, string Severity, string Status,
    string ServiceName, string SubscriptionName, DateTimeOffset CreatedDate, int AgeDays);
public sealed record SupportTicketDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalOpenTickets, int CriticalCount, int HighCount, int ModeratCount, int MinimalCount,
    IReadOnlyCollection<SupportTicketDto> Tickets);

// ── VMSS Health ───────────────────────────────────────────────────────────────
public sealed record VmssItemDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string Sku, int Capacity, string ProvisioningState, string UpgradePolicy);
public sealed record VmssHealthDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalScaleSets, int RunningCount, int FailedCount,
    int TotalInstances,
    IReadOnlyCollection<VmssItemDto> ScaleSets);

// ── ExpressRoute ──────────────────────────────────────────────────────────────
public sealed record ExpressRouteCircuitDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string ServiceProvider, string PeeringLocation, int BandwidthMbps,
    string CircuitProvisioningState, string ServiceProviderProvisioningState,
    string Sku, string Tier);
public sealed record ExpressRoutePeeringDto(
    string CircuitId, string CircuitName, string PeeringType, string State,
    string PrimaryPrefix, string SecondaryPrefix);
public sealed record ExpressRouteDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalCircuits, int ProvisionedCount, int NotProvisionedCount,
    int TotalBandwidthMbps,
    IReadOnlyCollection<ExpressRouteCircuitDto> Circuits,
    IReadOnlyCollection<ExpressRoutePeeringDto> Peerings);

// ── Virtual WAN ───────────────────────────────────────────────────────────────
public sealed record VwanDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string VwanType, string ProvisioningState, int HubCount);
public sealed record VwanHubDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string VwanId, string AddressPrefix, string ProvisioningState, string HubRoutingPreference);
public sealed record VwanDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalVwans, int TotalHubs, int ConnectedHubs,
    IReadOnlyCollection<VwanDto> Vwans,
    IReadOnlyCollection<VwanHubDto> Hubs);

// ── Azure Firewall ────────────────────────────────────────────────────────────
public sealed record AzureFirewallInstanceDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string SkuTier, string ThreatIntelMode, string ProvisioningState,
    string? PolicyName, bool IsVirtualHubBased, int PublicIpCount);
public sealed record AzureFirewallPolicyDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string ThreatIntelMode, bool DnsProxyEnabled, bool TlsInspectionEnabled,
    int LinkedFirewallCount);
public sealed record AzureFirewallTrafficPointDto(string Hour, long AllowedCount, long DeniedCount);
public sealed record AzureFirewallTopBlockedDto(string Destination, long HitCount);
public sealed record AzureFirewallThreatHitDto(string ThreatName, string SourceIp, string DestinationIp, string Action, long Count);
public sealed record AzureFirewallPermissiveRuleDto(
    string PolicyName, string RuleCollectionName, string RuleName,
    string SourceAddresses, string DestinationAddresses, string DestinationPorts);
public sealed record AzureFirewallInsightDto(string Category, string Message, string Severity);
public sealed record AzureFirewallDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalFirewalls, int HealthyCount, int DegradedCount,
    bool HasPolicies, bool HasLogAnalyticsData,
    long TotalAllowedLast24h, long TotalBlockedLast24h,
    int ThreatIntelHits,
    IReadOnlyCollection<AzureFirewallInstanceDto> Firewalls,
    IReadOnlyCollection<AzureFirewallPolicyDto> Policies,
    IReadOnlyCollection<AzureFirewallTrafficPointDto> TrafficTrend,
    IReadOnlyCollection<AzureFirewallTopBlockedDto> TopBlockedDestinations,
    IReadOnlyCollection<AzureFirewallThreatHitDto> ThreatHits,
    IReadOnlyCollection<AzureFirewallPermissiveRuleDto> PermissiveRules,
    IReadOnlyCollection<AzureFirewallInsightDto> Insights);

// ── Application Gateway ───────────────────────────────────────────────────────
public sealed record AppGatewayInstanceDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string SkuTier, int SkuCapacity, string ProvisioningState,
    bool WafEnabled, string WafMode, string WafRuleSetType, string WafRuleSetVersion,
    string SslPolicyName, int BackendPoolCount, int ListenerCount, int RoutingRuleCount,
    bool Http2Enabled, bool AutoscaleEnabled, int FrontendPublicIpCount);
public sealed record AppGatewayTrafficPointDto(string Hour, long RequestCount, long BlockedCount);
public sealed record AppGatewayTopUrlDto(string Url, long RequestCount);
public sealed record AppGatewayWafBlockDto(string RuleId, string Message, long HitCount);
public sealed record AppGatewayInsightDto(string Category, string Message, string Severity);
public sealed record AppGatewayListenerDto(
    string GatewayId, string ListenerName, string Protocol, string Hostname);
public sealed record AppGatewayDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalGateways, int HealthyCount, int DegradedCount,
    int WafEnabledCount, int WafPreventionCount,
    long TotalRequests24h, long TotalBlocked24h,
    bool HasLogAnalyticsData,
    IReadOnlyCollection<AppGatewayInstanceDto> Gateways,
    IReadOnlyCollection<AppGatewayListenerDto> Listeners,
    IReadOnlyCollection<AppGatewayTrafficPointDto> TrafficTrend,
    IReadOnlyCollection<AppGatewayTopUrlDto> TopUrls,
    IReadOnlyCollection<AppGatewayWafBlockDto> TopWafBlocks,
    IReadOnlyCollection<AppGatewayInsightDto> Insights);

// ── VPN Gateway ───────────────────────────────────────────────────────────────
public sealed record VpnGatewayInstanceDto(
    string ResourceId, string Name, string SubscriptionName, string Location,
    string SkuName, string Generation, string GatewayType, string VpnType,
    bool BgpEnabled, long BgpAsn, bool ActiveActiveEnabled, string ProvisioningState,
    int ConnectionCount);
public sealed record VpnGatewayConnectionDto(
    string ResourceId, string Name, string SubscriptionName,
    string ConnectionType, string ConnectionStatus,
    bool BgpEnabled, string LocalNetworkGatewayName, string LocalNetworkGatewayIp, string RemoteVnetName);
public sealed record VpnGatewayTunnelPointDto(string Hour, long BytesIn, long BytesOut);
public sealed record VpnGatewayInsightDto(string Category, string Message, string Severity);
public sealed record VpnGatewayDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalGateways, int HealthyCount, int DegradedCount,
    int TotalConnections, int ConnectedTunnels,
    bool HasLogAnalyticsData,
    IReadOnlyCollection<VpnGatewayInstanceDto> Gateways,
    IReadOnlyCollection<VpnGatewayConnectionDto> Connections,
    IReadOnlyCollection<VpnGatewayTunnelPointDto> TunnelTrend,
    IReadOnlyCollection<VpnGatewayInsightDto> Insights);

// ── Identity Attack Surface ───────────────────────────────────────────────────
public sealed record IdentityRiskFindingDto(
    string Id, string Title, string Severity, int Count, string Category, string Recommendation);
public sealed record PrivilegedRoleAssignmentDto(
    string PrincipalName, string PrincipalType, string RoleName,
    string SubscriptionName, bool IsOwnerRole);
public sealed record RiskySignInEventDto(
    string UserDisplayName, string UserPrincipalName,
    string RiskLevel, string IpAddress, string SignInTime);
public sealed record ConditionalAccessPolicySummaryDto(
    string PolicyName, int AppliedCount, int BlockedCount, int MfaRequiredCount);
public sealed record IdentityAttackSurfaceDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalPrivilegedAssignments, int OwnerAssignments, int ServicePrincipalOwnerCount,
    int CustomRoleCount, int GuestUserAssignments,
    int IdentityRiskScore,
    int RiskySignInCount, int RiskyUserCount, int PimActivationCount, int MfaBlockedCount,
    bool HasSignInLogData, bool HasAuditLogData,
    IReadOnlyCollection<IdentityRiskFindingDto> Findings,
    IReadOnlyCollection<PrivilegedRoleAssignmentDto> PrivilegedRoles,
    IReadOnlyCollection<RiskySignInEventDto> RiskySignIns,
    IReadOnlyCollection<ConditionalAccessPolicySummaryDto> ConditionalAccessPolicies);

// ── Azure Monitor Alerts ──────────────────────────────────────────────────────
public sealed record AlertItemDto(
    string AlertId, string Name, string Severity, string AlertState,
    string MonitorCondition, string TargetResource, string TargetResourceType,
    string MonitorService, string SubscriptionName, DateTimeOffset FiredDateTime);
public sealed record AlertServiceCountDto(string ServiceName, int Count);
public sealed record AlertsDashboardDto(
    string TenantId, DateTimeOffset GeneratedAt,
    int TotalActive, int Sev0Count, int Sev1Count, int Sev2Count, int Sev3Count, int Sev4Count,
    int NewCount, int AcknowledgedCount,
    IReadOnlyCollection<AlertServiceCountDto> ByService,
    IReadOnlyCollection<AlertItemDto> Alerts);
