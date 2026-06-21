namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class DailySnapshotEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public DateTimeOffset SnapshotDate { get; set; }
    public decimal AzureHealthScore { get; set; }
    public decimal SecurityScore { get; set; }
    public decimal CostEfficiencyScore { get; set; }
    public decimal ReliabilityScore { get; set; }
    public decimal GovernanceScore { get; set; }
    public decimal BusinessImpactEstimateEur { get; set; }
}
