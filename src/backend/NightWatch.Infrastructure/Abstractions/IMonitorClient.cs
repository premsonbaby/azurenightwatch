using System.Text.Json;

namespace NightWatch.Infrastructure.Abstractions;

public interface IMonitorClient
{
    Task<JsonDocument> QueryWorkspaceAsync(string workspaceId, string kqlQuery, CancellationToken cancellationToken);
}
