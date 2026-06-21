namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class ThresholdBreachEntity
{
    public int Id { get; set; }
    public int ThresholdId { get; set; }
    public string TenantId { get; set; } = "";
    public string MetricType { get; set; } = "";
    public decimal ThresholdValue { get; set; }
    public decimal ActualValue { get; set; }
    public DateTimeOffset BreachedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }

    // Narrative fields — populated by AlertNarrativeEngine at breach time
    public string? AlertTitle { get; set; }
    public string? BusinessImpact { get; set; }
    public string? SuggestedAction { get; set; }
    public string Severity { get; set; } = "High";

    // Acknowledgement
    public bool IsAcknowledged { get; set; }
    public DateTimeOffset? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }
}
