using NightWatch.Application.Contracts;

namespace NightWatch.Application.Abstractions;

public interface IAlertThresholdService
{
    Task<IReadOnlyList<AlertThresholdDto>> GetThresholdsAsync(string tenantId, CancellationToken ct = default);
    Task<AlertThresholdDto> CreateThresholdAsync(string tenantId, UpsertThresholdRequest request, CancellationToken ct = default);
    Task<AlertThresholdDto> UpdateThresholdAsync(int id, UpsertThresholdRequest request, CancellationToken ct = default);
    Task DeleteThresholdAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<ThresholdBreachDto>> GetBreachesAsync(string tenantId, int maxRows = 100, CancellationToken ct = default);
    Task<IReadOnlyList<ThresholdBreachDto>> GetOpenBreachesAcrossAllTenantsAsync(CancellationToken ct = default);
    Task CheckAndRecordBreachesAsync(string tenantId, string metricType, decimal currentValue, CancellationToken ct = default, string? tenantName = null, decimal? dailyBurnRate = null, int? daysLeft = null);
    Task AcknowledgeBreachAsync(int breachId, string acknowledgedBy, CancellationToken ct = default);
}
