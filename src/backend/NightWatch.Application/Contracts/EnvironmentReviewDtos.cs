namespace NightWatch.Application.Contracts;

public sealed record EnvironmentReviewSummaryDto(
    int Id,
    string TenantId,
    string CustomerName,
    string ReviewDate,
    string ReviewedBy,
    string Status,
    string? OverallMaturity,
    int FindingCount,
    int CriticalCount,
    int HighCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record EnvironmentReviewDetailDto(
    int Id,
    string TenantId,
    string CustomerName,
    string ReviewDate,
    string ReviewedBy,
    string Status,
    string? Scope,
    string? ExecutiveSummary,
    string? OverallMaturity,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<ReviewFindingDto> Findings);

public sealed record ReviewFindingDto(
    int Id,
    int ReviewId,
    string Pillar,
    string Severity,
    string Title,
    string Description,
    string Recommendation,
    string? Evidence,
    string? EffortEstimate,
    string Status,
    string? LibraryRef,
    DateTimeOffset CreatedAt);

public sealed record CreateEnvironmentReviewRequest(
    string CustomerName,
    string ReviewDate,
    string ReviewedBy,
    string? Scope,
    string? ExecutiveSummary,
    string? OverallMaturity);

public sealed record UpdateEnvironmentReviewRequest(
    string? CustomerName,
    string? ReviewDate,
    string? ReviewedBy,
    string? Status,
    string? Scope,
    string? ExecutiveSummary,
    string? OverallMaturity);

public sealed record CreateReviewFindingRequest(
    string Pillar,
    string Severity,
    string Title,
    string Description,
    string Recommendation,
    string? Evidence,
    string? EffortEstimate,
    string? LibraryRef);

public sealed record UpdateReviewFindingRequest(
    string? Pillar,
    string? Severity,
    string? Title,
    string? Description,
    string? Recommendation,
    string? Evidence,
    string? EffortEstimate,
    string? Status,
    string? LibraryRef);

public sealed record FindingLibraryItemDto(
    string Ref,
    string Pillar,
    string Severity,
    string Title,
    string Description,
    string Recommendation,
    string? EffortEstimate);
