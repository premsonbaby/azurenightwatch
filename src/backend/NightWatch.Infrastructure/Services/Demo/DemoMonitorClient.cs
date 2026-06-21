using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Demo;

public sealed class DemoMonitorClient : IMonitorClient
{
    private static readonly Random Rng = new(42);

    public Task<JsonDocument> QueryWorkspaceAsync(string workspaceId, string kqlQuery, CancellationToken cancellationToken)
    {
        var json = kqlQuery.Contains("Processor", StringComparison.OrdinalIgnoreCase)
            ? BuildTimeseries("TimeGenerated", "Value", GenerateCpuTrend())
            : kqlQuery.Contains("Disk", StringComparison.OrdinalIgnoreCase)
            ? BuildTimeseries("TimeGenerated", "Value", GenerateDiskTrend())
            : kqlQuery.Contains("Bytes", StringComparison.OrdinalIgnoreCase)
            ? BuildTimeseries("TimeGenerated", "Value", GenerateNetworkTrend())
            : kqlQuery.Contains("Failures", StringComparison.OrdinalIgnoreCase)
            ? BuildScalar("Failures", 12)
            : BuildTimeseries("TimeGenerated", "Value", GenerateCpuTrend());

        return Task.FromResult(JsonDocument.Parse(json));
    }

    private static (string Timestamp, double Value)[] GenerateCpuTrend()
    {
        var rng = new Random(42);
        var now = DateTime.UtcNow;
        return Enumerable.Range(0, 24)
            .Select(i => (now.AddHours(-23 + i).ToString("o"), 35.0 + rng.NextDouble() * 30.0))
            .ToArray();
    }

    private static (string Timestamp, double Value)[] GenerateDiskTrend()
    {
        var rng = new Random(43);
        var now = DateTime.UtcNow;
        return Enumerable.Range(0, 24)
            .Select(i => (now.AddHours(-23 + i).ToString("o"), 2.5 + rng.NextDouble() * 4.0))
            .ToArray();
    }

    private static (string Timestamp, double Value)[] GenerateNetworkTrend()
    {
        var rng = new Random(44);
        var now = DateTime.UtcNow;
        return Enumerable.Range(0, 24)
            .Select(i => (now.AddHours(-23 + i).ToString("o"), 1200.0 + rng.NextDouble() * 3800.0))
            .ToArray();
    }

    private static string BuildTimeseries(string tsColumn, string valueColumn, (string Timestamp, double Value)[] points)
    {
        var rows = string.Join(",",
            points.Select(p => $"[\"{p.Timestamp}\",{p.Value:F2}]"));

        return $$"""
            {
              "tables": [
                {
                  "name": "PrimaryResult",
                  "columns": [
                    {"name": "{{tsColumn}}", "type": "datetime"},
                    {"name": "{{valueColumn}}", "type": "real"}
                  ],
                  "rows": [{{rows}}]
                }
              ]
            }
            """;
    }

    private static string BuildScalar(string column, int value) => $$"""
        {
          "tables": [
            {
              "name": "PrimaryResult",
              "columns": [{"name": "{{column}}", "type": "long"}],
              "rows": [[{{value}}]]
            }
          ]
        }
        """;
}
