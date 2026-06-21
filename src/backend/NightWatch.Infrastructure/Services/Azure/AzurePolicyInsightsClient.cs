using Azure.Core;
using Microsoft.Extensions.Logging;
using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

public sealed class AzurePolicyInsightsClient(
    HttpClient httpClient,
    TokenCredential credential,
    ILogger<AzurePolicyInsightsClient> logger) : AzureApiClientBase(httpClient, credential, logger), IAzurePolicyInsightsClient
{
    private static readonly TokenRequestContext ManagementScope = new(["https://management.azure.com/.default"]);

    public Task<JsonDocument> SummarizeSubscriptionAsync(string subscriptionId, CancellationToken cancellationToken)
    {
        return SendWithRetryAsync(
            () => new HttpRequestMessage(
                HttpMethod.Post,
                $"/subscriptions/{subscriptionId}/providers/Microsoft.PolicyInsights/policyStates/latest/summarize?api-version=2019-10-01"),
            ManagementScope,
            cancellationToken);
    }
}
