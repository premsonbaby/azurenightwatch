using System.Text.Json;

namespace NightWatch.Infrastructure.Abstractions;

public interface IAzurePolicyInsightsClient
{
    Task<JsonDocument> SummarizeSubscriptionAsync(string subscriptionId, CancellationToken cancellationToken);
}
