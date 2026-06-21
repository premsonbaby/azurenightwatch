namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class AlertThresholdEntity
{
    public int Id { get; set; }
    public string TenantId { get; set; } = "";
    public string MetricType { get; set; } = "";
    public decimal ThresholdValue { get; set; }
    public string AlertChannel { get; set; } = "Teams";
    public bool IsEnabled { get; set; } = true;
    public string? TeamsWebhookUrl { get; set; }
    public string? AlertEmail { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
