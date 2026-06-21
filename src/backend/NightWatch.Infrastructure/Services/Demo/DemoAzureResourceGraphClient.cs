using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Demo;

public sealed class DemoAzureResourceGraphClient : IAzureResourceGraphClient
{
    private static readonly Random Rng = new(42);

    public Task<JsonDocument> QueryResourcesAsync(
        string query,
        IReadOnlyCollection<string> subscriptions,
        IReadOnlyCollection<string>? managementGroups,
        CancellationToken cancellationToken)
    {
        var data = DispatchQuery(query);
        return Task.FromResult(WrapInDataDocument(data));
    }

    private static string DispatchQuery(string q)
    {
        // Protected backup items (most specific first)
        if (q.Contains("protectioncontainers/protecteditems", StringComparison.OrdinalIgnoreCase))
            return FakeResources("rsv-item", "Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems", 18);

        if (q.Contains("backuppolicies", StringComparison.OrdinalIgnoreCase))
            return FakeResources("backup-policy", "Microsoft.RecoveryServices/vaults/backupPolicies", 3);

        if (q.Contains("recoveryservices/vaults", StringComparison.OrdinalIgnoreCase))
            return FakeResources("rsv", "Microsoft.RecoveryServices/vaults", 2);

        // NSGs with rules (Any/Any detection)
        if (q.Contains("networksecuritygroups", StringComparison.OrdinalIgnoreCase) && q.Contains("securityRules", StringComparison.OrdinalIgnoreCase))
            return FakeNsgWithAnyAnyRule();

        // Unused disks
        if (q.Contains("compute/disks", StringComparison.OrdinalIgnoreCase) && q.Contains("managedBy", StringComparison.OrdinalIgnoreCase))
            return FakeResources("orphan-disk", "Microsoft.Compute/disks", 8);

        // Unused NICs
        if (q.Contains("networkinterfaces", StringComparison.OrdinalIgnoreCase) && q.Contains("virtualMachine", StringComparison.OrdinalIgnoreCase))
            return FakeResources("orphan-nic", "Microsoft.Network/networkInterfaces", 3);

        // Abandoned public IPs (isempty ipConfiguration)
        if (q.Contains("publicipaddresses", StringComparison.OrdinalIgnoreCase) && q.Contains("ipConfiguration", StringComparison.OrdinalIgnoreCase))
            return FakeResourcesWithDetails("orphan-pip", "Microsoft.Network/publicIPAddresses", 2);

        // All public IPs
        if (q.Contains("publicipaddresses", StringComparison.OrdinalIgnoreCase))
            return FakeResourcesWithDetails("pip", "Microsoft.Network/publicIPAddresses", 12);

        // Owner role assignments
        if (q.Contains("roleassignments", StringComparison.OrdinalIgnoreCase))
            return FakeResources("ra", "Microsoft.Authorization/roleAssignments", 3);

        // VMs
        if (q.Contains("virtualmachines", StringComparison.OrdinalIgnoreCase))
            return FakeVms(25);

        // VNets
        if (q.Contains("microsoft.network/virtualnetworks", StringComparison.OrdinalIgnoreCase))
            return FakeResources("vnet", "Microsoft.Network/virtualNetworks", 8);

        // NSG count
        if (q.Contains("networksecuritygroups", StringComparison.OrdinalIgnoreCase))
            return FakeResources("nsg", "Microsoft.Network/networkSecurityGroups", 12);

        // Storage accounts
        if (q.Contains("storageaccounts", StringComparison.OrdinalIgnoreCase))
            return FakeResources("stg", "Microsoft.Storage/storageAccounts", 15);

        // Databases
        if (q.Contains("microsoft.sql/servers/databases", StringComparison.OrdinalIgnoreCase) || q.Contains("microsoft.dbfor", StringComparison.OrdinalIgnoreCase))
            return FakeResources("sqldb", "Microsoft.Sql/servers/databases", 6);

        // Managed identities
        if (q.Contains("userassignedidentities", StringComparison.OrdinalIgnoreCase))
            return FakeResources("mi", "Microsoft.ManagedIdentity/userAssignedIdentities", 10);

        // Untagged resources
        if (q.Contains("isempty(tags)", StringComparison.OrdinalIgnoreCase) || q.Contains("bag_length(tags)", StringComparison.OrdinalIgnoreCase))
            return FakeResources("untagged", "Microsoft.Compute/virtualMachines", 35);

        // Naming non-compliant
        if (q.Contains("!matches regex", StringComparison.OrdinalIgnoreCase))
            return FakeResources("BadName_VM", "Microsoft.Compute/virtualMachines", 18);

        // App Service Plans (for commitment candidates)
        if (q.Contains("serverfarms", StringComparison.OrdinalIgnoreCase))
            return FakeResources("asp", "Microsoft.Web/serverFarms", 4);

        // App Services
        if (q.Contains("microsoft.web/sites", StringComparison.OrdinalIgnoreCase))
            return FakeResources("app", "Microsoft.Web/sites", 8);

        // Total resources (catch-all counting query)
        if (q.TrimEnd().EndsWith("| project id", StringComparison.OrdinalIgnoreCase))
            return FakeResources("res", "Microsoft.Compute/virtualMachines", 150);

        // Fallback: empty
        return "[]";
    }

    private static string FakeResources(string namePrefix, string type, int count)
    {
        var items = Enumerable.Range(1, count).Select(i =>
            $"{{\"id\":\"/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/{type}/{namePrefix}-{i:D3}\",\"name\":\"{namePrefix}-{i:D3}\",\"type\":\"{type}\"}}");
        return "[" + string.Join(",", items) + "]";
    }

    private static string FakeResourcesWithDetails(string namePrefix, string type, int count)
    {
        var items = Enumerable.Range(1, count).Select(i =>
            $"{{\"id\":\"/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/{type}/{namePrefix}-{i:D3}\",\"name\":\"{namePrefix}-{i:D3}\",\"type\":\"{type}\",\"location\":\"northeurope\"}}");
        return "[" + string.Join(",", items) + "]";
    }

    private static string FakeVms(int count)
    {
        var skus = new[] { "Standard_D2s_v3", "Standard_D4s_v3", "Standard_B2s", "Standard_E4s_v3" };
        var items = Enumerable.Range(1, count).Select(i =>
            $"{{\"id\":\"/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-{i:D3}\",\"name\":\"vm-{i:D3}\",\"type\":\"Microsoft.Compute/virtualMachines\",\"sku\":{{\"name\":\"{skus[i % skus.Length]}\"}},\"properties\":{{\"powerState\":\"running\"}}}}");
        return "[" + string.Join(",", items) + "]";
    }

    private static string FakeNsgWithAnyAnyRule()
    {
        // One NSG with an Any/Any inbound rule (triggers the security finding)
        return """
            [
              {
                "id": "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Network/networkSecurityGroups/nsg-legacy-001",
                "name": "nsg-legacy-001",
                "type": "Microsoft.Network/networkSecurityGroups",
                "rules": [
                  {
                    "name": "AllowAll",
                    "properties": {
                      "direction": "Inbound",
                      "access": "Allow",
                      "protocol": "*",
                      "sourceAddressPrefix": "*",
                      "destinationAddressPrefix": "*",
                      "sourcePortRange": "*",
                      "destinationPortRange": "*"
                    }
                  }
                ]
              },
              {
                "id": "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Network/networkSecurityGroups/nsg-web-001",
                "name": "nsg-web-001",
                "type": "Microsoft.Network/networkSecurityGroups",
                "rules": [
                  {
                    "name": "AllowHttps",
                    "properties": {
                      "direction": "Inbound",
                      "access": "Allow",
                      "protocol": "Tcp",
                      "sourceAddressPrefix": "*",
                      "destinationAddressPrefix": "*",
                      "sourcePortRange": "*",
                      "destinationPortRange": "443"
                    }
                  }
                ]
              }
            ]
            """;
    }

    private static JsonDocument WrapInDataDocument(string jsonArray)
    {
        var json = $"{{\"data\":{jsonArray}}}";
        return JsonDocument.Parse(json);
    }
}
