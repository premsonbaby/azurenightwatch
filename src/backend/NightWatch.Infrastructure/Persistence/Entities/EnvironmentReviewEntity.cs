namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class EnvironmentReviewEntity
{
    public int Id { get; set; }
    public string TenantId { get; set; } = string.Empty;

    /// <summary>Display name of the customer being reviewed</summary>
    public string CustomerName { get; set; } = string.Empty;

    /// <summary>Review date (ISO date string YYYY-MM-DD)</summary>
    public string ReviewDate { get; set; } = string.Empty;

    /// <summary>Email of the MSP engineer who performed the review</summary>
    public string ReviewedBy { get; set; } = string.Empty;

    /// <summary>Draft | InProgress | Completed | Delivered</summary>
    public string Status { get; set; } = "Draft";

    /// <summary>Scope description — what was in scope for this review</summary>
    public string? Scope { get; set; }

    /// <summary>Executive summary paragraph(s)</summary>
    public string? ExecutiveSummary { get; set; }

    /// <summary>Overall maturity rating: Initial | Developing | Defined | Managed | Optimising</summary>
    public string? OverallMaturity { get; set; }

    /// <summary>JSON array of ReviewFinding IDs (managed via relationship)</summary>
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<ReviewFindingEntity> Findings { get; set; } = [];
}
