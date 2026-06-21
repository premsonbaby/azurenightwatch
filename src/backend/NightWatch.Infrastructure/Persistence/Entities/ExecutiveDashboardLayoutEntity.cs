namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class ExecutiveDashboardLayoutEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string UserObjectId { get; set; } = string.Empty;
    public string LayoutJson { get; set; } = "[]";
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
