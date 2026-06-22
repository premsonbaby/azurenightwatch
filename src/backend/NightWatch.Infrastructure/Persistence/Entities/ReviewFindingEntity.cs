namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class ReviewFindingEntity
{
    public int Id { get; set; }
    public int ReviewId { get; set; }

    /// <summary>Security | Cost | Performance | Reliability | Governance | Identity | Network | OperationalExcellence</summary>
    public string Pillar { get; set; } = "General";

    /// <summary>Critical | High | Medium | Low | Informational</summary>
    public string Severity { get; set; } = "Medium";

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Recommendation { get; set; } = string.Empty;

    /// <summary>Resource names / IDs affected (comma-separated or prose)</summary>
    public string? Evidence { get; set; }

    /// <summary>QuickWin | ShortTerm | LongTerm</summary>
    public string? EffortEstimate { get; set; }

    /// <summary>Open | AcceptedRisk | Resolved</summary>
    public string Status { get; set; } = "Open";

    /// <summary>If from finding library, reference slug for audit trail</summary>
    public string? LibraryRef { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public EnvironmentReviewEntity Review { get; set; } = null!;
}
