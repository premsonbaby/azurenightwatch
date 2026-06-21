using Azure.Core;
using Microsoft.Extensions.Logging;
using NightWatch.Infrastructure.Abstractions;
using System.Text;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

public sealed class AzureResourceGraphClient(
    HttpClient httpClient,
    TokenCredential credential,
    ILogger<AzureResourceGraphClient> logger) : AzureApiClientBase(httpClient, credential, logger), IAzureResourceGraphClient
{
    private static readonly TokenRequestContext ManagementScope = new(["https://management.azure.com/.default"]);

    // Global gate: CollectLiveSignalsAsync fires ~15 ARG queries concurrently.
    // Without throttling, many 429 responses cause count queries to return 0,
    // making the blast radius and other derived graphs show incorrect/missing nodes.
    private static readonly SemaphoreSlim ArgConcurrencyGate = new(4, 4);

    public async Task<JsonDocument> QueryResourcesAsync(
        string query,
        IReadOnlyCollection<string> subscriptions,
        IReadOnlyCollection<string>? managementGroups,
        CancellationToken cancellationToken)
    {
        await ArgConcurrencyGate.WaitAsync(cancellationToken);
        try
        {
        // Paginate through all ARG results. ARG returns up to 1000 rows per request and
        // includes a $skipToken when more pages are available. Without this, large environments
        // silently truncate results (e.g. >1000 peerings causes some to appear as standalone VNets).
        const int MaxPages = 20;
        var allData = new List<JsonElement>();
        string? skipToken = null;

        for (var page = 0; page < MaxPages; page++)
        {
            var payload = JsonSerializer.Serialize(new
            {
                subscriptions,
                managementGroups,
                query,
                options = new
                {
                    resultFormat = "objectArray",
                    skipToken,
                }
            });

            var doc = await SendWithRetryAsync(
                () =>
                {
                    var req = new HttpRequestMessage(HttpMethod.Post, "/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01");
                    req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
                    return req;
                },
                ManagementScope,
                cancellationToken);

            using (doc)
            {
                if (doc.RootElement.TryGetProperty("data", out var dataEl) && dataEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var element in dataEl.EnumerateArray())
                        allData.Add(element.Clone()); // Clone before doc is disposed
                }

                skipToken = null;
                if (doc.RootElement.TryGetProperty("$skipToken", out var tokenEl) && tokenEl.ValueKind == JsonValueKind.String)
                    skipToken = tokenEl.GetString();
            }

            if (skipToken == null) break;

            logger.LogDebug("ARG query has more pages (page {Page}), continuing with skipToken.", page + 1);
        }

        // Build a combined JsonDocument so all callers receive the merged data array.
        using var ms = new System.IO.MemoryStream();
        using var writer = new Utf8JsonWriter(ms);
        writer.WriteStartObject();
        writer.WritePropertyName("data");
        writer.WriteStartArray();
        foreach (var element in allData)
            element.WriteTo(writer);
        writer.WriteEndArray();
        writer.WriteEndObject();
        writer.Flush();

        ms.Position = 0;
        return await JsonDocument.ParseAsync(ms, cancellationToken: cancellationToken);
        }
        finally
        {
            ArgConcurrencyGate.Release();
        }
    }
}
