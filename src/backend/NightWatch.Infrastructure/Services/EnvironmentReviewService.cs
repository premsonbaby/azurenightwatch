using Microsoft.EntityFrameworkCore;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;

namespace NightWatch.Infrastructure.Services;

public sealed class EnvironmentReviewService(NightWatchDbContext db)
{
    public async Task<IReadOnlyList<EnvironmentReviewSummaryDto>> GetReviewsAsync(string tenantId, CancellationToken ct = default)
    {
        var reviews = await db.EnvironmentReviews
            .Include(r => r.Findings)
            .Where(r => r.TenantId == tenantId)
            .OrderByDescending(r => r.ReviewDate)
            .ToListAsync(ct);

        return reviews.Select(ToSummary).ToList();
    }

    public async Task<EnvironmentReviewDetailDto?> GetReviewAsync(string tenantId, int id, CancellationToken ct = default)
    {
        var review = await db.EnvironmentReviews
            .Include(r => r.Findings)
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == id, ct);
        return review is null ? null : ToDetail(review);
    }

    public async Task<EnvironmentReviewDetailDto> CreateReviewAsync(string tenantId, CreateEnvironmentReviewRequest req, CancellationToken ct = default)
    {
        var entity = new EnvironmentReviewEntity
        {
            TenantId = tenantId,
            CustomerName = req.CustomerName,
            ReviewDate = req.ReviewDate,
            ReviewedBy = req.ReviewedBy,
            Status = "Draft",
            Scope = req.Scope,
            ExecutiveSummary = req.ExecutiveSummary,
            OverallMaturity = req.OverallMaturity,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.EnvironmentReviews.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToDetail(entity);
    }

    public async Task<EnvironmentReviewDetailDto?> UpdateReviewAsync(string tenantId, int id, UpdateEnvironmentReviewRequest req, CancellationToken ct = default)
    {
        var entity = await db.EnvironmentReviews.Include(r => r.Findings)
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == id, ct);
        if (entity is null) return null;

        if (req.CustomerName is not null) entity.CustomerName = req.CustomerName;
        if (req.ReviewDate is not null) entity.ReviewDate = req.ReviewDate;
        if (req.ReviewedBy is not null) entity.ReviewedBy = req.ReviewedBy;
        if (req.Status is not null) entity.Status = req.Status;
        if (req.Scope is not null) entity.Scope = req.Scope;
        if (req.ExecutiveSummary is not null) entity.ExecutiveSummary = req.ExecutiveSummary;
        if (req.OverallMaturity is not null) entity.OverallMaturity = req.OverallMaturity;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return ToDetail(entity);
    }

    public async Task<bool> DeleteReviewAsync(string tenantId, int id, CancellationToken ct = default)
    {
        var entity = await db.EnvironmentReviews.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == id, ct);
        if (entity is null) return false;
        db.EnvironmentReviews.Remove(entity);
        await db.SaveChangesAsync(ct);
        return true;
    }

    // ── Findings ────────────────────────────────────────────────────────────────

    public async Task<ReviewFindingDto?> AddFindingAsync(string tenantId, int reviewId, CreateReviewFindingRequest req, CancellationToken ct = default)
    {
        var review = await db.EnvironmentReviews.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == reviewId, ct);
        if (review is null) return null;

        var finding = new ReviewFindingEntity
        {
            ReviewId = reviewId,
            Pillar = req.Pillar,
            Severity = req.Severity,
            Title = req.Title,
            Description = req.Description,
            Recommendation = req.Recommendation,
            Evidence = req.Evidence,
            EffortEstimate = req.EffortEstimate,
            Status = "Open",
            LibraryRef = req.LibraryRef,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.ReviewFindings.Add(finding);
        review.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToFindingDto(finding);
    }

    public async Task<ReviewFindingDto?> UpdateFindingAsync(string tenantId, int reviewId, int findingId, UpdateReviewFindingRequest req, CancellationToken ct = default)
    {
        var finding = await db.ReviewFindings
            .Include(f => f.Review)
            .FirstOrDefaultAsync(f => f.Id == findingId && f.ReviewId == reviewId && f.Review.TenantId == tenantId, ct);
        if (finding is null) return null;

        if (req.Pillar is not null) finding.Pillar = req.Pillar;
        if (req.Severity is not null) finding.Severity = req.Severity;
        if (req.Title is not null) finding.Title = req.Title;
        if (req.Description is not null) finding.Description = req.Description;
        if (req.Recommendation is not null) finding.Recommendation = req.Recommendation;
        if (req.Evidence is not null) finding.Evidence = req.Evidence;
        if (req.EffortEstimate is not null) finding.EffortEstimate = req.EffortEstimate;
        if (req.Status is not null) finding.Status = req.Status;
        if (req.LibraryRef is not null) finding.LibraryRef = req.LibraryRef;
        finding.Review.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return ToFindingDto(finding);
    }

    public async Task<bool> DeleteFindingAsync(string tenantId, int reviewId, int findingId, CancellationToken ct = default)
    {
        var finding = await db.ReviewFindings
            .Include(f => f.Review)
            .FirstOrDefaultAsync(f => f.Id == findingId && f.ReviewId == reviewId && f.Review.TenantId == tenantId, ct);
        if (finding is null) return false;
        db.ReviewFindings.Remove(finding);
        finding.Review.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }

    // ── Finding Library ─────────────────────────────────────────────────────────

    public static IReadOnlyList<FindingLibraryItemDto> GetFindingLibrary() => FindingLibrary.Items;

    // ── PDF ─────────────────────────────────────────────────────────────────────

    public async Task<byte[]> GeneratePdfAsync(string tenantId, int id, CancellationToken ct = default)
    {
        var review = await db.EnvironmentReviews.Include(r => r.Findings)
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == id, ct)
            ?? throw new KeyNotFoundException($"Review {id} not found for tenant {tenantId}");
        return EnvironmentReviewPdfBuilder.Build(review);
    }

    // ── Mappers ─────────────────────────────────────────────────────────────────

    private static EnvironmentReviewSummaryDto ToSummary(EnvironmentReviewEntity r) => new(
        r.Id, r.TenantId, r.CustomerName, r.ReviewDate, r.ReviewedBy, r.Status, r.OverallMaturity,
        r.Findings.Count,
        r.Findings.Count(f => f.Severity == "Critical"),
        r.Findings.Count(f => f.Severity == "High"),
        r.CreatedAt, r.UpdatedAt);

    private static EnvironmentReviewDetailDto ToDetail(EnvironmentReviewEntity r) => new(
        r.Id, r.TenantId, r.CustomerName, r.ReviewDate, r.ReviewedBy, r.Status,
        r.Scope, r.ExecutiveSummary, r.OverallMaturity,
        r.CreatedAt, r.UpdatedAt,
        r.Findings.Select(ToFindingDto).ToList());

    private static ReviewFindingDto ToFindingDto(ReviewFindingEntity f) => new(
        f.Id, f.ReviewId, f.Pillar, f.Severity, f.Title, f.Description,
        f.Recommendation, f.Evidence, f.EffortEstimate, f.Status, f.LibraryRef, f.CreatedAt);
}
