using System.Text.Json;

namespace NightWatch.Infrastructure.Abstractions;

public interface IDefenderClient
{
    Task<JsonDocument> GetAssessmentsAsync(string subscriptionId, CancellationToken cancellationToken);
}
