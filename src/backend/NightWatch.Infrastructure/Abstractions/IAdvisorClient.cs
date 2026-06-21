using System.Text.Json;

namespace NightWatch.Infrastructure.Abstractions;

public interface IAdvisorClient
{
    Task<JsonDocument> GetRecommendationsAsync(string subscriptionId, CancellationToken cancellationToken);
}
