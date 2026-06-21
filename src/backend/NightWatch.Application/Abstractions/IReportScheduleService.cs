using NightWatch.Application.Contracts;

namespace NightWatch.Application.Abstractions;

public interface IReportScheduleService
{
    Task<ReportScheduleDto> GetScheduleAsync(string tenantId, CancellationToken ct);
    Task<ReportScheduleDto> UpsertScheduleAsync(string tenantId, UpsertReportScheduleRequest request, CancellationToken ct);
    Task<IReadOnlyList<ReportSentLogDto>> GetHistoryAsync(string tenantId, int maxRows, CancellationToken ct);
    Task<IReadOnlyList<ReportSentLogDto>> GetAllHistoryAsync(int maxRows, CancellationToken ct);
    Task LogSendAsync(string tenantId, string displayName, int recipientCount, string status, string? error, long fileSizeBytes, string reportType, CancellationToken ct);
}
