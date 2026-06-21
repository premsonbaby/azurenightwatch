using Microsoft.EntityFrameworkCore;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;
using QuestPDF.Infrastructure;
using System.Globalization;

namespace NightWatch.Infrastructure.Services;

public sealed class MonthlyReviewService(NightWatchDbContext db, ITenantRegistryService tenantRegistry) : IMonthlyReviewService
{
    public async Task<MonthlyReviewDto> GetReviewAsync(string tenantId, string? month, CancellationToken ct)
    {
        var targetMonth = month ?? DateTimeOffset.UtcNow.ToString("yyyy-MM", CultureInfo.InvariantCulture);

        string tenantDisplayName;
        if (tenantId == "global")
        {
            tenantDisplayName = "Home Tenant";
        }
        else
        {
            var tenant = await tenantRegistry.GetTenantAsync(tenantId, ct);
            tenantDisplayName = tenant?.DisplayName ?? tenantId;
        }

        // Fetch this month and the previous month snapshot
        var snapshots = await db.MonthlyHealthSnapshots
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.SnapshotMonth)
            .Take(12)
            .ToListAsync(ct);

        var thisSnap = snapshots.FirstOrDefault(s => s.SnapshotMonth == targetMonth);

        // Find the previous month by sorting and picking the one just before targetMonth
        var prevSnap = snapshots
            .Where(s => string.Compare(s.SnapshotMonth, targetMonth, StringComparison.Ordinal) < 0)
            .OrderByDescending(s => s.SnapshotMonth)
            .FirstOrDefault();

        var actionItems = await db.ActionItems
            .Where(a => a.TenantId == tenantId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

        var openItems = actionItems.Where(a => a.Status == "Open").ToList();
        var resolvedThisMonth = actionItems.Count(a =>
            a.Status == "Resolved" &&
            a.ResolvedAt.HasValue &&
            a.ResolvedAt.Value.ToString("yyyy-MM", CultureInfo.InvariantCulture) == targetMonth);

        List<ScoreDimensionComparison> dimensions = [];
        List<ScoreDimensionComparison> improved = [];
        List<ScoreDimensionComparison> declined = [];

        decimal overallScore = thisSnap?.AzureHealthScore ?? 0;
        decimal? previousOverallScore = prevSnap?.AzureHealthScore;
        decimal? overallDelta = thisSnap is null || prevSnap is null
            ? null
            : Math.Round(thisSnap.AzureHealthScore - prevSnap.AzureHealthScore, 1);

        if (thisSnap is not null)
        {
            var pairs = new[]
            {
                ("Security",    thisSnap.SecurityPostureScore,      prevSnap?.SecurityPostureScore),
                ("Cost",        thisSnap.CostEfficiencyScore,       prevSnap?.CostEfficiencyScore),
                ("Performance", thisSnap.PerformanceScore,          prevSnap?.PerformanceScore),
                ("Reliability", thisSnap.ReliabilityScore,          prevSnap?.ReliabilityScore),
                ("Governance",  thisSnap.GovernanceComplianceScore, prevSnap?.GovernanceComplianceScore),
            };

            foreach (var (dim, cur, prev) in pairs)
            {
                var delta = prev.HasValue ? Math.Round(cur - prev.Value, 1) : 0m;
                var trend = delta > 0.5m ? "improved" : delta < -0.5m ? "declined" : "stable";
                var comp = new ScoreDimensionComparison(dim, cur, prev ?? cur, delta, trend);
                dimensions.Add(comp);
                if (trend == "improved") improved.Add(comp);
                else if (trend == "declined") declined.Add(comp);
            }
        }

        var allItems = actionItems.Select(MapToDto).ToList();

        return new MonthlyReviewDto(
            TenantId: tenantId,
            TenantDisplayName: tenantDisplayName,
            Month: targetMonth,
            MonthLabel: FormatMonthLabel(targetMonth),
            PreviousMonth: prevSnap?.SnapshotMonth,
            PreviousMonthLabel: prevSnap is null ? null : FormatMonthLabel(prevSnap.SnapshotMonth),
            OverallScore: overallScore,
            PreviousOverallScore: previousOverallScore,
            OverallDelta: overallDelta,
            Dimensions: dimensions,
            Improved: improved,
            Declined: declined,
            OpenActionItems: openItems.Count,
            ResolvedThisMonth: resolvedThisMonth,
            ActionItems: allItems,
            HasPreviousData: prevSnap is not null);
    }

    public async Task<IReadOnlyList<ActionItemDto>> GetActionItemsAsync(string tenantId, string? month, CancellationToken ct)
    {
        var query = db.ActionItems.Where(a => a.TenantId == tenantId);
        if (month is not null)
            query = query.Where(a => a.Month == month);

        var items = await query.OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return items.Select(MapToDto).ToList();
    }

    public async Task<ActionItemDto> CreateActionItemAsync(
        string tenantId, string month, CreateActionItemRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Title is required.");

        var entity = new ActionItemEntity
        {
            TenantId = tenantId,
            Month = month,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            Priority = NormalisePriority(request.Priority),
            Category = NormaliseCategory(request.Category),
            Status = "Open",
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.ActionItems.Add(entity);
        await db.SaveChangesAsync(ct);
        return MapToDto(entity);
    }

    public async Task<ActionItemDto> UpdateActionItemAsync(
        string tenantId, int id, UpdateActionItemRequest request, string updatedByEmail, CancellationToken ct)
    {
        var entity = await db.ActionItems
            .FirstOrDefaultAsync(a => a.TenantId == tenantId && a.Id == id, ct)
            ?? throw new KeyNotFoundException($"Action item {id} not found.");

        if (request.Title is not null) entity.Title = request.Title.Trim();
        if (request.Description is not null) entity.Description = request.Description.Trim();
        if (request.Priority is not null) entity.Priority = NormalisePriority(request.Priority);
        if (request.ResolutionNote is not null) entity.ResolutionNote = request.ResolutionNote.Trim();

        if (request.Status is not null)
        {
            var newStatus = NormaliseStatus(request.Status);
            if (newStatus == "Resolved" && entity.Status != "Resolved")
            {
                entity.ResolvedAt = DateTimeOffset.UtcNow;
                entity.ResolvedBy = updatedByEmail;
            }
            else if (newStatus != "Resolved")
            {
                entity.ResolvedAt = null;
                entity.ResolvedBy = null;
            }
            entity.Status = newStatus;
        }

        await db.SaveChangesAsync(ct);
        return MapToDto(entity);
    }

    public async Task DeleteActionItemAsync(string tenantId, int id, CancellationToken ct)
    {
        var entity = await db.ActionItems
            .FirstOrDefaultAsync(a => a.TenantId == tenantId && a.Id == id, ct)
            ?? throw new KeyNotFoundException($"Action item {id} not found.");

        db.ActionItems.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    public async Task<byte[]> GenerateReviewPdfAsync(string tenantId, string? month, string? mspName, CancellationToken ct)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var review = await GetReviewAsync(tenantId, month, ct);
        return MonthlyReviewPdfBuilder.Build(review, mspName);
    }

    private static ActionItemDto MapToDto(ActionItemEntity e) => new(
        e.Id, e.TenantId, e.Month, e.Title, e.Description,
        e.Priority, e.Status, e.Category,
        e.CreatedAt, e.ResolvedAt, e.ResolvedBy, e.ResolutionNote);

    private static string NormalisePriority(string? v) =>
        v?.Trim() switch { "High" => "High", "Low" => "Low", _ => "Medium" };

    private static string NormaliseCategory(string? v) =>
        v?.Trim() switch
        {
            "Security" => "Security",
            "Cost" => "Cost",
            "Performance" => "Performance",
            "Reliability" => "Reliability",
            "Governance" => "Governance",
            _ => "General"
        };

    private static string NormaliseStatus(string? v) =>
        v?.Trim() switch { "Resolved" => "Resolved", "Dismissed" => "Dismissed", _ => "Open" };

    private static string FormatMonthLabel(string yyyyMm)
    {
        if (DateTimeOffset.TryParseExact(yyyyMm + "-01", "yyyy-MM-dd",
            CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            return dt.ToString("MMMM yyyy", CultureInfo.InvariantCulture);
        return yyyyMm;
    }
}
