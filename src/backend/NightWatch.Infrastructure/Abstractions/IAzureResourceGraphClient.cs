using System.Text.Json;

namespace NightWatch.Infrastructure.Abstractions;

public interface IAzureResourceGraphClient
{
    Task<JsonDocument> QueryResourcesAsync(
        string query,
        IReadOnlyCollection<string> subscriptions,
        IReadOnlyCollection<string>? managementGroups,
        CancellationToken cancellationToken);
}
