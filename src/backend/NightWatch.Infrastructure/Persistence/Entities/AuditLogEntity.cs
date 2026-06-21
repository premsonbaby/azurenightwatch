namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class AuditLogEntity
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    public string UserEmail { get; set; } = "";
    public string HttpMethod { get; set; } = "";
    public string Path { get; set; } = "";
    public string? TenantId { get; set; }
    public string? IpAddress { get; set; }
    public int StatusCode { get; set; }
    public int DurationMs { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}
