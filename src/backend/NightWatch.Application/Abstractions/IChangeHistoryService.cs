using NightWatch.Application.Contracts;

namespace NightWatch.Application.Abstractions;

public interface IChangeHistoryService
{
    Task<ChangesDashboardDto> GetChangesAsync(string tenantId, string timeRange, CancellationToken cancellationToken);
}
