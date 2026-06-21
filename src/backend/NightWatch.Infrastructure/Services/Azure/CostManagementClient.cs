using Azure.Core;
using Microsoft.Extensions.Logging;
using NightWatch.Infrastructure.Abstractions;
using System.Text;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

public sealed class CostManagementClient(
    HttpClient httpClient,
    TokenCredential credential,
    ILogger<CostManagementClient> logger) : AzureApiClientBase(httpClient, credential, logger), ICostManagementClient
{
    private static readonly TokenRequestContext ManagementScope = new(["https://management.azure.com/.default"]);

    public Task<JsonDocument> QueryCostAsync(string subscriptionId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new
        {
            type = "ActualCost",
            timeframe = "Custom",
            timePeriod = new
            {
                from = from.UtcDateTime,
                to = to.UtcDateTime
            },
            dataset = new
            {
                granularity = "Daily",
                aggregation = new
                {
                    totalCost = new
                    {
                        name = "Cost",
                        function = "Sum"
                    }
                }
            }
        });

        return SendWithRetryAsync(
            () =>
            {
                var request = new HttpRequestMessage(
                    HttpMethod.Post,
                    $"/subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01");
                request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
                return request;
            },
            ManagementScope,
            cancellationToken);
    }

    public Task<JsonDocument> QueryCostByResourceAsync(string subscriptionId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new
        {
            type = "ActualCost",
            timeframe = "Custom",
            timePeriod = new
            {
                from = from.UtcDateTime,
                to = to.UtcDateTime
            },
            dataset = new
            {
                granularity = "None",
                aggregation = new
                {
                    totalCost = new
                    {
                        name = "Cost",
                        function = "Sum"
                    }
                },
                grouping = new object[]
                {
                    new { type = "Dimension", name = "ResourceId" },
                    new { type = "Dimension", name = "ResourceType" },
                    new { type = "Dimension", name = "PricingModel" }
                }
            }
        });

        return SendWithRetryAsync(
            () =>
            {
                var request = new HttpRequestMessage(
                    HttpMethod.Post,
                    $"/subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01");
                request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
                return request;
            },
            ManagementScope,
            cancellationToken);
    }
}
