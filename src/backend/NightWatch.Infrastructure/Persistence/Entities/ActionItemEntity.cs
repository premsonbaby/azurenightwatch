namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class ActionItemEntity
{
    public int Id { get; set; }
    public string TenantId { get; set; } = string.Empty;

    /// <summary>Month this action item was created in. Format: "YYYY-MM"</summary>
    public string Month { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    /// <summary>High | Medium | Low</summary>
    public string Priority { get; set; } = "Medium";

    /// <summary>Open | Resolved | Dismissed</summary>
    public string Status { get; set; } = "Open";

    /// <summary>Security | Cost | Performance | Reliability | Governance | General</summary>
    public string Category { get; set; } = "General";

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? ResolvedBy { get; set; }
    public string? ResolutionNote { get; set; }
}
