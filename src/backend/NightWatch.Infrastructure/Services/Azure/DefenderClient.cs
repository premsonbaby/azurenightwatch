using Azure.Core;
using Microsoft.Extensions.Logging;
using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

public sealed class DefenderClient(
    HttpClient httpClient,
    TokenCredential credential,
    ILogger<DefenderClient> logger) : AzureApiClientBase(httpClient, credential, logger), IDefenderClient
{
    private static readonly TokenRequestContext ManagementScope = new(["https://management.azure.com/.default"]);

    public Task<JsonDocument> GetAssessmentsAsync(string subscriptionId, CancellationToken cancellationToken)
    {
        return SendWithRetryAsync(
            () => new HttpRequestMessage(
                HttpMethod.Get,
                $"/subscriptions/{subscriptionId}/providers/Microsoft.Security/assessments?api-version=2020-01-01"),
            ManagementScope,
            cancellationToken);
    }
}
