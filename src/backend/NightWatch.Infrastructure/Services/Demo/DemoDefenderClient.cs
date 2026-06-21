using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Demo;

public sealed class DemoDefenderClient : IDefenderClient
{
    private const string FakeAssessments = """
        {
          "value": [
            { "id": "a1", "name": "Enable MFA for accounts with owner permissions", "properties": { "status": { "code": "Unhealthy" } } },
            { "id": "a2", "name": "Endpoint protection should be installed on machines", "properties": { "status": { "code": "Unhealthy" } } },
            { "id": "a3", "name": "Storage accounts should restrict network access", "properties": { "status": { "code": "Unhealthy" } } },
            { "id": "a4", "name": "SQL databases should have vulnerability assessment configured", "properties": { "status": { "code": "Unhealthy" } } },
            { "id": "a5", "name": "Key vaults should have purge protection enabled", "properties": { "status": { "code": "Unhealthy" } } },
            { "id": "a6", "name": "Virtual machines should encrypt temp disks, caches, and data flows", "properties": { "status": { "code": "Unhealthy" } } },
            { "id": "a7", "name": "Automation account variables should be encrypted", "properties": { "status": { "code": "Unhealthy" } } }
          ]
        }
        """;

    public Task<JsonDocument> GetAssessmentsAsync(string subscriptionId, CancellationToken cancellationToken)
        => Task.FromResult(JsonDocument.Parse(FakeAssessments));
}
