namespace NightWatch.Infrastructure.Abstractions;

public sealed record ReportOptions(bool AiEnabled = false, string? TenantDisplayName = null, string? MspName = null);

public interface IReportService
{
    Task<string> GenerateHtmlReportAsync(string tenantId, ReportOptions options, CancellationToken cancellationToken = default);
    Task<byte[]> GeneratePdfReportAsync(string tenantId, ReportOptions options, CancellationToken cancellationToken = default);
}
