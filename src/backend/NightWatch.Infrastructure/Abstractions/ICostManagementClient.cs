using System.Text.Json;

namespace NightWatch.Infrastructure.Abstractions;

public interface ICostManagementClient
{
    Task<JsonDocument> QueryCostAsync(string subscriptionId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);
    Task<JsonDocument> QueryCostByResourceAsync(string subscriptionId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);
}
