using Azure.Core;
using Microsoft.Extensions.Logging;
using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

public sealed class AdvisorClient(
    HttpClient httpClient,
    TokenCredential credential,
    ILogger<AdvisorClient> logger) : AzureApiClientBase(httpClient, credential, logger), IAdvisorClient
{
    private static readonly TokenRequestContext ManagementScope = new(["https://management.azure.com/.default"]);

    public Task<JsonDocument> GetRecommendationsAsync(string subscriptionId, CancellationToken cancellationToken)
    {
        return SendWithRetryAsync(
            () => new HttpRequestMessage(
                HttpMethod.Get,
                $"/subscriptions/{subscriptionId}/providers/Microsoft.Advisor/recommendations?api-version=2023-01-01"),
            ManagementScope,
            cancellationToken);
    }
}
