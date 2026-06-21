namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class MonthlyHealthSnapshotEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;

    /// <summary>Format: "YYYY-MM" e.g. "2026-05"</summary>
    public string SnapshotMonth { get; set; } = string.Empty;

    public decimal AzureHealthScore { get; set; }
    public decimal SecurityPostureScore { get; set; }
    public decimal PerformanceScore { get; set; }
    public decimal CostEfficiencyScore { get; set; }
    public decimal ReliabilityScore { get; set; }
    public decimal GovernanceComplianceScore { get; set; }
    public int ActiveCriticalAlerts { get; set; }
    public decimal BackupCoveragePercent { get; set; }
    public int SubscriptionCount { get; set; }
    public DateTimeOffset CapturedAt { get; set; }
}
