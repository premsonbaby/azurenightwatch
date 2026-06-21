using NightWatch.Application.Contracts;

namespace NightWatch.Application.Abstractions;

public interface IHealthSnapshotService
{
    /// <summary>Captures a snapshot of the current health scores for the given tenant and stores it for the current month. Safe to call multiple times — upserts on (TenantId, SnapshotMonth).</summary>
    Task CaptureSnapshotAsync(string tenantId, CancellationToken cancellationToken);

    /// <summary>Returns the last <paramref name="months"/> monthly snapshots, newest first, with month-on-month deltas.</summary>
    Task<HealthSnapshotHistoryDto> GetHistoryAsync(string tenantId, int months, CancellationToken cancellationToken);
}
