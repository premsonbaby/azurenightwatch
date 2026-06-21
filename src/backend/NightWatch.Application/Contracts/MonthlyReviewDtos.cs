namespace NightWatch.Application.Contracts;

public sealed record ActionItemDto(
    int Id,
    string TenantId,
    string Month,
    string Title,
    string Description,
    string Priority,
    string Status,
    string Category,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ResolvedAt,
    string? ResolvedBy,
    string? ResolutionNote);

public sealed record CreateActionItemRequest(
    string Title,
    string Description,
    string Priority,
    string Category);

public sealed record UpdateActionItemRequest(
    string? Title,
    string? Description,
    string? Priority,
    string? Status,
    string? ResolutionNote);

public sealed record ScoreDimensionComparison(
    string Dimension,
    decimal ThisMonth,
    decimal LastMonth,
    decimal Delta,
    string Trend);  // "improved" | "declined" | "stable"

public sealed record MonthlyReviewDto(
    string TenantId,
    string TenantDisplayName,
    string Month,
    string MonthLabel,
    string? PreviousMonth,
    string? PreviousMonthLabel,
    decimal OverallScore,
    decimal? PreviousOverallScore,
    decimal? OverallDelta,
    IReadOnlyList<ScoreDimensionComparison> Dimensions,
    IReadOnlyList<ScoreDimensionComparison> Improved,
    IReadOnlyList<ScoreDimensionComparison> Declined,
    int OpenActionItems,
    int ResolvedThisMonth,
    IReadOnlyList<ActionItemDto> ActionItems,
    bool HasPreviousData);

public sealed record MonthlyReviewSendRequest(
    IReadOnlyList<string> Recipients,
    bool IncludeActionItems);
