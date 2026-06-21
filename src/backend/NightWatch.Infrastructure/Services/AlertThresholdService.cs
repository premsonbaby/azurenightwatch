using Microsoft.EntityFrameworkCore;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;

namespace NightWatch.Infrastructure.Services;

public sealed class AlertThresholdService(NightWatchDbContext db) : IAlertThresholdService
{
    public async Task<IReadOnlyList<AlertThresholdDto>> GetThresholdsAsync(string tenantId, CancellationToken ct = default)
    {
        var entities = await db.AlertThresholds
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.MetricType)
            .ToListAsync(ct);
        return entities.Select(ToDto).ToList();
    }

    public async Task<AlertThresholdDto> CreateThresholdAsync(string tenantId, UpsertThresholdRequest request, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var entity = new AlertThresholdEntity
        {
            TenantId = tenantId,
            MetricType = request.MetricType,
            ThresholdValue = request.ThresholdValue,
            AlertChannel = request.AlertChannel,
            IsEnabled = request.IsEnabled,
            TeamsWebhookUrl = string.IsNullOrWhiteSpace(request.TeamsWebhookUrl) ? null : request.TeamsWebhookUrl.Trim(),
            AlertEmail = string.IsNullOrWhiteSpace(request.AlertEmail) ? null : request.AlertEmail.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.AlertThresholds.Add(entity);
        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<AlertThresholdDto> UpdateThresholdAsync(int id, UpsertThresholdRequest request, CancellationToken ct = default)
    {
        var entity = await db.AlertThresholds.FindAsync([id], ct)
            ?? throw new InvalidOperationException($"Threshold {id} not found.");
        entity.MetricType = request.MetricType;
        entity.ThresholdValue = request.ThresholdValue;
        entity.AlertChannel = request.AlertChannel;
        entity.IsEnabled = request.IsEnabled;
        entity.TeamsWebhookUrl = string.IsNullOrWhiteSpace(request.TeamsWebhookUrl) ? null : request.TeamsWebhookUrl.Trim();
        entity.AlertEmail = string.IsNullOrWhiteSpace(request.AlertEmail) ? null : request.AlertEmail.Trim();
        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task DeleteThresholdAsync(int id, CancellationToken ct = default)
    {
        var entity = await db.AlertThresholds.FindAsync([id], ct)
            ?? throw new InvalidOperationException($"Threshold {id} not found.");
        db.AlertThresholds.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ThresholdBreachDto>> GetBreachesAsync(string tenantId, int maxRows = 100, CancellationToken ct = default)
    {
        var entities = await db.ThresholdBreaches
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.BreachedAt)
            .Take(maxRows)
            .ToListAsync(ct);
        return entities.Select(ToBreachDto).ToList();
    }

    public async Task<IReadOnlyList<ThresholdBreachDto>> GetOpenBreachesAcrossAllTenantsAsync(CancellationToken ct = default)
    {
        var entities = await db.ThresholdBreaches
            .Where(x => x.ResolvedAt == null && !x.IsAcknowledged)
            .OrderByDescending(x => x.BreachedAt)
            .Take(200)
            .ToListAsync(ct);
        return entities.Select(ToBreachDto).ToList();
    }

    public async Task CheckAndRecordBreachesAsync(
        string tenantId,
        string metricType,
        decimal currentValue,
        CancellationToken ct = default,
        string? tenantName = null,
        decimal? dailyBurnRate = null,
        int? daysLeft = null)
    {
        var thresholds = await db.AlertThresholds
            .Where(x => x.TenantId == tenantId && x.MetricType == metricType && x.IsEnabled)
            .ToListAsync(ct);

        foreach (var threshold in thresholds)
        {
            var isBreaching = IsCeilingMetric(metricType)
                ? currentValue > threshold.ThresholdValue
                : currentValue < threshold.ThresholdValue;

            var openBreach = await db.ThresholdBreaches
                .Where(x => x.ThresholdId == threshold.Id && x.ResolvedAt == null)
                .FirstOrDefaultAsync(ct);

            if (isBreaching && openBreach is null)
            {
                var narrative = AlertNarrativeEngine.Generate(
                    metricType, currentValue, threshold.ThresholdValue,
                    tenantName, dailyBurnRate, daysLeft);

                db.ThresholdBreaches.Add(new ThresholdBreachEntity
                {
                    ThresholdId = threshold.Id,
                    TenantId = tenantId,
                    MetricType = metricType,
                    ThresholdValue = threshold.ThresholdValue,
                    ActualValue = currentValue,
                    BreachedAt = DateTimeOffset.UtcNow,
                    AlertTitle = narrative.Title,
                    BusinessImpact = narrative.BusinessImpact,
                    SuggestedAction = narrative.SuggestedAction,
                    Severity = narrative.Severity,
                });
                await db.SaveChangesAsync(ct);
            }
            else if (!isBreaching && openBreach is not null)
            {
                openBreach.ResolvedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
            }
        }
    }

    public async Task AcknowledgeBreachAsync(int breachId, string acknowledgedBy, CancellationToken ct = default)
    {
        var entity = await db.ThresholdBreaches.FindAsync([breachId], ct)
            ?? throw new InvalidOperationException($"Breach {breachId} not found.");
        entity.IsAcknowledged = true;
        entity.AcknowledgedAt = DateTimeOffset.UtcNow;
        entity.AcknowledgedBy = acknowledgedBy;
        await db.SaveChangesAsync(ct);
    }

    private static bool IsCeilingMetric(string metricType) =>
        metricType is "MonthlyCostCeiling" or "MonthlyCostRunRate";

    private static AlertThresholdDto ToDto(AlertThresholdEntity e) => new(
        e.Id, e.TenantId, e.MetricType, e.ThresholdValue, e.AlertChannel, e.IsEnabled,
        e.TeamsWebhookUrl, e.AlertEmail, e.CreatedAt, e.UpdatedAt);

    private static ThresholdBreachDto ToBreachDto(ThresholdBreachEntity e) => new(
        e.Id, e.ThresholdId, e.TenantId, e.MetricType, e.ThresholdValue, e.ActualValue,
        e.BreachedAt, e.ResolvedAt,
        e.AlertTitle, e.BusinessImpact, e.SuggestedAction, e.Severity,
        e.IsAcknowledged, e.AcknowledgedAt, e.AcknowledgedBy);
}
