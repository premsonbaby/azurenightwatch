using NightWatch.Infrastructure.Abstractions;
using System.Text;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Demo;

public sealed class DemoCostManagementClient : ICostManagementClient
{
    private static readonly Random Rng = new(42);

    public Task<JsonDocument> QueryCostAsync(string subscriptionId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        var rows = BuildDailyRows(from, to, baseDaily: 185m, variancePct: 0.25m);
        return Task.FromResult(BuildCostDocument(rows, groupByResource: false));
    }

    public Task<JsonDocument> QueryCostByResourceAsync(string subscriptionId, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        var rows = BuildResourceRows();
        return Task.FromResult(BuildCostDocument(rows, groupByResource: true));
    }

    private static List<object[]> BuildDailyRows(DateTimeOffset from, DateTimeOffset to, decimal baseDaily, decimal variancePct)
    {
        var rows = new List<object[]>();
        var rng = new Random(42);
        var current = from.Date;
        while (current <= to.Date)
        {
            var variance = (decimal)(rng.NextDouble() * 2.0 - 1.0) * variancePct;
            var cost = Math.Round(baseDaily * (1m + variance), 2);
            rows.Add([cost, int.Parse(current.ToString("yyyyMMdd")), "EUR"]);
            current = current.AddDays(1);
        }
        return rows;
    }

    private static List<object[]> BuildResourceRows()
    {
        return
        [
            [1240.50, "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-001", "Microsoft.Compute/virtualMachines", "PayAsYouGo", "EUR"],
            [980.25,  "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-002", "Microsoft.Compute/virtualMachines", "PayAsYouGo", "EUR"],
            [840.00,  "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-003", "Microsoft.Compute/virtualMachines", "Reserved",   "EUR"],
            [720.75,  "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Sql/servers/sql-prod/databases/db-001", "Microsoft.Sql/servers/databases", "PayAsYouGo", "EUR"],
            [580.00,  "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Storage/storageAccounts/stgprod001", "Microsoft.Storage/storageAccounts", "PayAsYouGo", "EUR"],
            [430.20,  "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Web/serverFarms/asp-prod-001", "Microsoft.Web/serverFarms", "PayAsYouGo", "EUR"],
            [380.80,  "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-004", "Microsoft.Compute/virtualMachines", "PayAsYouGo", "EUR"],
            [295.40,  "/subscriptions/demo-sub-001/resourceGroups/demo-rg/providers/Microsoft.Network/applicationGateways/agw-001", "Microsoft.Network/applicationGateways", "PayAsYouGo", "EUR"],
        ];
    }

    private static JsonDocument BuildCostDocument(List<object[]> rows, bool groupByResource)
    {
        var columns = groupByResource
            ? new[] { "Cost", "ResourceId", "ResourceType", "PricingModel", "Currency" }
            : new[] { "Cost", "UsageDate", "Currency" };

        var sb = new StringBuilder();
        sb.Append("{\"properties\":{\"currency\":\"EUR\",\"columns\":[");
        sb.Append(string.Join(",", columns.Select(c => $"{{\"name\":\"{c}\",\"type\":\"Number\"}}")));
        sb.Append("],\"rows\":[");

        for (var i = 0; i < rows.Count; i++)
        {
            if (i > 0) sb.Append(',');
            sb.Append('[');
            for (var j = 0; j < rows[i].Length; j++)
            {
                if (j > 0) sb.Append(',');
                var val = rows[i][j];
                if (val is string s) sb.Append($"\"{s}\"");
                else sb.Append(val);
            }
            sb.Append(']');
        }

        sb.Append("]}}");
        return JsonDocument.Parse(sb.ToString());
    }
}
