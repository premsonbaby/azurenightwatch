using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Demo;

public sealed class DemoAdvisorClient : IAdvisorClient
{
    private const string FakeRecommendations = """
        {
          "value": [
            {
              "id": "r1", "category": "Cost",
              "properties": { "shortDescription": { "problem": "Buy reserved instances to save on VM costs" } }
            },
            {
              "id": "r2", "category": "Cost",
              "properties": { "shortDescription": { "problem": "Right-size or shutdown underutilised virtual machines" } }
            },
            {
              "id": "r3", "category": "Cost",
              "properties": { "shortDescription": { "problem": "Consider Azure Savings Plans for compute workloads" } }
            },
            {
              "id": "r4", "category": "Performance",
              "properties": { "shortDescription": { "problem": "Use Premium SSD for production workloads with high IOPS" } }
            },
            {
              "id": "r5", "category": "Performance",
              "properties": { "shortDescription": { "problem": "Enable Accelerated Networking on supported VMs" } }
            },
            {
              "id": "r6", "category": "HighAvailability",
              "properties": { "shortDescription": { "problem": "Deploy VMs in Availability Zones for SLA improvement" } }
            },
            {
              "id": "r7", "category": "HighAvailability",
              "properties": { "shortDescription": { "problem": "Enable soft delete on Key Vaults for accidental deletion protection" } }
            },
            {
              "id": "r8", "category": "Security",
              "properties": { "shortDescription": { "problem": "Enable just-in-time VM access for management ports" } }
            }
          ]
        }
        """;

    public Task<JsonDocument> GetRecommendationsAsync(string subscriptionId, CancellationToken cancellationToken)
        => Task.FromResult(JsonDocument.Parse(FakeRecommendations));
}
