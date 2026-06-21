namespace NightWatch.Application.Contracts;

public sealed record MonthlyHealthSnapshotDto(
    string TenantId,
    string SnapshotMonth,
    string MonthLabel,
    decimal AzureHealthScore,
    decimal SecurityPostureScore,
    decimal PerformanceScore,
    decimal CostEfficiencyScore,
    decimal ReliabilityScore,
    decimal GovernanceComplianceScore,
    int ActiveCriticalAlerts,
    decimal BackupCoveragePercent,
    int SubscriptionCount,
    DateTimeOffset CapturedAt,

    // Deltas vs previous month (null for the oldest snapshot)
    decimal? AzureHealthDelta,
    decimal? SecurityDelta,
    decimal? PerformanceDelta,
    decimal? CostDelta,
    decimal? ReliabilityDelta,
    decimal? GovernanceDelta);

public sealed record HealthSnapshotHistoryDto(
    string TenantId,
    IReadOnlyList<MonthlyHealthSnapshotDto> Months,
    int TotalMonths);
