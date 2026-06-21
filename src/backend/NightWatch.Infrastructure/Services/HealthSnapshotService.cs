using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;
using System.Globalization;

namespace NightWatch.Infrastructure.Services;

public sealed class HealthSnapshotService(
    NightWatchDbContext db,
    INightWatchInsightsService insightsService,
    ILogger<HealthSnapshotService> logger) : IHealthSnapshotService
{
    public async Task CaptureSnapshotAsync(string tenantId, CancellationToken cancellationToken)
    {
        var month = DateTimeOffset.UtcNow.ToString("yyyy-MM", CultureInfo.InvariantCulture);

        try
        {
            var executive = await insightsService.GetExecutiveDashboardAsync(tenantId, cancellationToken);
            var subscriptionCount = executive.SubscriptionRiskHeatmap?.Count() ?? 0;

            var activeCriticalAlerts = await db.ThresholdBreaches
                .CountAsync(b => b.TenantId == tenantId && b.ResolvedAt == null && !b.IsAcknowledged && b.Severity == "Critical", cancellationToken);

            var existing = await db.MonthlyHealthSnapshots
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.SnapshotMonth == month, cancellationToken);

            if (existing is null)
            {
                db.MonthlyHealthSnapshots.Add(new MonthlyHealthSnapshotEntity
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SnapshotMonth = month,
                    AzureHealthScore = executive.AzureHealthScore,
                    SecurityPostureScore = executive.SecurityPostureScore,
                    PerformanceScore = executive.PerformanceScore,
                    CostEfficiencyScore = executive.CostEfficiencyScore,
                    ReliabilityScore = executive.ReliabilityScore,
                    GovernanceComplianceScore = executive.GovernanceComplianceScore,
                    ActiveCriticalAlerts = activeCriticalAlerts,
                    BackupCoveragePercent = executive.BackupCoveragePercent,
                    SubscriptionCount = subscriptionCount,
                    CapturedAt = DateTimeOffset.UtcNow,
                });
            }
            else
            {
                // Update in-month — keep the latest reading
                existing.AzureHealthScore = executive.AzureHealthScore;
                existing.SecurityPostureScore = executive.SecurityPostureScore;
                existing.PerformanceScore = executive.PerformanceScore;
                existing.CostEfficiencyScore = executive.CostEfficiencyScore;
                existing.ReliabilityScore = executive.ReliabilityScore;
                existing.GovernanceComplianceScore = executive.GovernanceComplianceScore;
                existing.ActiveCriticalAlerts = activeCriticalAlerts;
                existing.BackupCoveragePercent = executive.BackupCoveragePercent;
                existing.SubscriptionCount = subscriptionCount;
                existing.CapturedAt = DateTimeOffset.UtcNow;
            }

            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Monthly health snapshot captured for tenant {TenantId}, month {Month}.", tenantId, month);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to capture monthly health snapshot for tenant {TenantId}.", tenantId);
        }
    }

    public async Task<HealthSnapshotHistoryDto> GetHistoryAsync(string tenantId, int months, CancellationToken cancellationToken)
    {
        var normalised = Math.Clamp(months, 1, 24);

        // Fetch one extra row so the oldest returned snapshot can have a delta vs its predecessor
        var fetched = await db.MonthlyHealthSnapshots
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.SnapshotMonth)
            .Take(normalised + 1)
            .ToListAsync(cancellationToken);

        // The extra row (if it exists) is the oldest — use it only for delta computation
        var hasPrev = fetched.Count > normalised;
        var rows = hasPrev ? fetched.Take(normalised).ToList() : fetched;

        // Build ordered list oldest→newest so deltas compare against the row before
        var ordered = fetched.OrderBy(s => s.SnapshotMonth).ToList();
        MonthlyHealthSnapshotEntity? prev = hasPrev ? ordered[0] : null;

        var startIndex = prev is null ? 0 : 1;
        var dtos = new List<MonthlyHealthSnapshotDto>();
        for (var i = startIndex; i < ordered.Count; i++)
        {
            var cur = ordered[i];
            var prevRow = i > 0 ? ordered[i - 1] : null;

            dtos.Add(new MonthlyHealthSnapshotDto(
                TenantId: cur.TenantId,
                SnapshotMonth: cur.SnapshotMonth,
                MonthLabel: FormatMonthLabel(cur.SnapshotMonth),
                AzureHealthScore: cur.AzureHealthScore,
                SecurityPostureScore: cur.SecurityPostureScore,
                PerformanceScore: cur.PerformanceScore,
                CostEfficiencyScore: cur.CostEfficiencyScore,
                ReliabilityScore: cur.ReliabilityScore,
                GovernanceComplianceScore: cur.GovernanceComplianceScore,
                ActiveCriticalAlerts: cur.ActiveCriticalAlerts,
                BackupCoveragePercent: cur.BackupCoveragePercent,
                SubscriptionCount: cur.SubscriptionCount,
                CapturedAt: cur.CapturedAt,
                AzureHealthDelta: prevRow is null ? null : Math.Round(cur.AzureHealthScore - prevRow.AzureHealthScore, 1),
                SecurityDelta: prevRow is null ? null : Math.Round(cur.SecurityPostureScore - prevRow.SecurityPostureScore, 1),
                PerformanceDelta: prevRow is null ? null : Math.Round(cur.PerformanceScore - prevRow.PerformanceScore, 1),
                CostDelta: prevRow is null ? null : Math.Round(cur.CostEfficiencyScore - prevRow.CostEfficiencyScore, 1),
                ReliabilityDelta: prevRow is null ? null : Math.Round(cur.ReliabilityScore - prevRow.ReliabilityScore, 1),
                GovernanceDelta: prevRow is null ? null : Math.Round(cur.GovernanceComplianceScore - prevRow.GovernanceComplianceScore, 1)));
        }

        // Return newest first
        dtos.Reverse();

        return new HealthSnapshotHistoryDto(tenantId, dtos, dtos.Count);
    }

    private static string FormatMonthLabel(string yyyyMm)
    {
        if (DateTimeOffset.TryParseExact(yyyyMm + "-01", "yyyy-MM-dd",
            CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dt))
            return dt.ToString("MMM yyyy", CultureInfo.InvariantCulture);
        return yyyyMm;
    }
}
