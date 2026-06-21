using Azure.Core;
using Microsoft.Extensions.Logging;
using NightWatch.Infrastructure.Abstractions;
using System.Text;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

public sealed class MonitorClient(
    HttpClient httpClient,
    TokenCredential credential,
    ILogger<MonitorClient> logger) : AzureApiClientBase(httpClient, credential, logger), IMonitorClient
{
    private static readonly TokenRequestContext MonitorScope = new(["https://api.loganalytics.io/.default"]);

    public Task<JsonDocument> QueryWorkspaceAsync(string workspaceId, string kqlQuery, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new { query = kqlQuery });

        return SendWithRetryAsync(
            () =>
            {
                var request = new HttpRequestMessage(HttpMethod.Post, $"/v1/workspaces/{workspaceId}/query");
                request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
                return request;
            },
            MonitorScope,
            cancellationToken);
    }
}
