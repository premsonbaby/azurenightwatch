namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class ReportSentLogEntity
{
    public int Id { get; set; }
    public string TenantId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public DateTimeOffset SentAt { get; set; }
    public int RecipientCount { get; set; }
    public string Status { get; set; } = "Sent";   // "Sent" | "Failed"
    public string? ErrorMessage { get; set; }
    public long FileSizeBytes { get; set; }
    public string ReportType { get; set; } = "Email"; // "Email" | "OnDemand"
}
