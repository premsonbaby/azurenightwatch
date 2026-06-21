using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Demo;

public sealed class DemoAzurePolicyInsightsClient : IAzurePolicyInsightsClient
{
    private const string FakeSummary = """
        {
          "value": [
            {
              "results": {
                "nonCompliantResources": 23,
                "nonCompliantPolicies": 5
              },
              "policyAssignments": [
                {
                  "policyAssignmentId": "/subscriptions/demo-sub-001/providers/Microsoft.Authorization/policyAssignments/require-tags",
                  "displayName": "Require tags on resources",
                  "results": { "nonCompliantResources": 12 },
                  "policyDefinitions": [
                    { "policyDefinitionId": "pd-tags", "effect": "Audit", "results": { "nonCompliantResources": 12 } }
                  ]
                },
                {
                  "policyAssignmentId": "/subscriptions/demo-sub-001/providers/Microsoft.Authorization/policyAssignments/allowed-locations",
                  "displayName": "Allowed locations",
                  "results": { "nonCompliantResources": 6 },
                  "policyDefinitions": [
                    { "policyDefinitionId": "pd-locations", "effect": "Deny", "results": { "nonCompliantResources": 6 } }
                  ]
                },
                {
                  "policyAssignmentId": "/subscriptions/demo-sub-001/providers/Microsoft.Authorization/policyAssignments/storage-https",
                  "displayName": "Secure transfer to storage accounts should be enabled",
                  "results": { "nonCompliantResources": 5 },
                  "policyDefinitions": [
                    { "policyDefinitionId": "pd-storage-https", "effect": "Audit", "results": { "nonCompliantResources": 5 } }
                  ]
                }
              ]
            }
          ]
        }
        """;

    public Task<JsonDocument> SummarizeSubscriptionAsync(string subscriptionId, CancellationToken cancellationToken)
        => Task.FromResult(JsonDocument.Parse(FakeSummary));
}
