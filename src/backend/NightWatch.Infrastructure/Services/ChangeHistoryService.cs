using System.Text.Json;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Infrastructure.Services;

public sealed class ChangeHistoryService(
    IAzureResourceGraphClient argClient,
    ISubscriptionDiscoveryService subscriptions) : IChangeHistoryService
{
    public async Task<ChangesDashboardDto> GetChangesAsync(string tenantId, string timeRange, CancellationToken cancellationToken)
    {
        var subs = await subscriptions.GetSubscriptionsAsync(cancellationToken);
        if (subs.Count == 0)
        {
            return new ChangesDashboardDto(timeRange, [], 0, 0, 0, 0, []);
        }

        var agoExpr = timeRange switch
        {
            "2days" => "ago(2d)",
            "1week" => "ago(7d)",
            _       => "ago(1d)",
        };

        var query = $"""
            resourcechanges
            | extend changeTime = todatetime(properties.changeAttributes.timestamp)
            | where changeTime >= {agoExpr}
            | extend changeType        = tostring(properties.changeType)
            | extend targetResourceId  = tostring(properties.targetResourceId)
            | extend targetResourceType = tostring(properties.targetResourceType)
            | extend changedBy         = tostring(properties.changeAttributes.changedBy)
            | extend changedByType     = tostring(properties.changeAttributes.changedByType)
            | extend clientType        = tostring(properties.changeAttributes.clientType)
            | extend correlationId     = tostring(properties.changeAttributes.correlationId)
            | order by changeTime desc
            | take 300
            | project changeTime, changeType, targetResourceId, targetResourceType,
                      changedBy, changedByType, clientType, correlationId,
                      subscriptionId, resourceGroup, changes = properties.changes
            """;

        var subIds = subs.Select(s => s.Id).ToArray();

        JsonDocument doc;
        try
        {
            doc = await argClient.QueryResourcesAsync(query, subIds, null, cancellationToken);
        }
        catch
        {
            return new ChangesDashboardDto(timeRange, [], 0, 0, 0, 0, []);
        }

        var events = ParseChangeEvents(doc, subs.ToDictionary(s => s.Id, s => s.DisplayName));

        var topChangedBy = events
            .Where(e => !string.IsNullOrWhiteSpace(e.ChangedBy))
            .GroupBy(e => e.ChangedBy, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .Take(5)
            .Select(g => g.Key)
            .ToArray();

        return new ChangesDashboardDto(
            timeRange,
            events,
            events.Count,
            events.Count(e => string.Equals(e.ChangeType, "Create", StringComparison.OrdinalIgnoreCase)),
            events.Count(e => string.Equals(e.ChangeType, "Update", StringComparison.OrdinalIgnoreCase)),
            events.Count(e => string.Equals(e.ChangeType, "Delete", StringComparison.OrdinalIgnoreCase)),
            topChangedBy);
    }

    private static IReadOnlyList<ChangeEventDto> ParseChangeEvents(
        JsonDocument doc,
        IReadOnlyDictionary<string, string> subNameMap)
    {
        var results = new List<ChangeEventDto>();

        if (!doc.RootElement.TryGetProperty("data", out var data))
            return results;

        var rows = data.ValueKind == JsonValueKind.Array
            ? data
            : data.TryGetProperty("rows", out var r) ? r : default;

        if (rows.ValueKind != JsonValueKind.Array)
            return results;

        foreach (var row in rows.EnumerateArray())
        {
            try
            {
                var resourceId  = GetString(row, "targetResourceId");
                var resourceType = GetString(row, "targetResourceType");
                var resourceName = ExtractLastSegment(resourceId);
                var resourceGroup = GetString(row, "resourceGroup");
                var subId        = GetString(row, "subscriptionId");
                var changeType   = GetString(row, "changeType");
                var changedBy    = GetString(row, "changedBy");
                var changedByType = GetString(row, "changedByType");
                var clientType   = GetString(row, "clientType");
                var correlationId = GetString(row, "correlationId");
                var changeTimeStr = GetString(row, "changeTime");

                if (!DateTimeOffset.TryParse(changeTimeStr, out var changeTime))
                    changeTime = DateTimeOffset.UtcNow;

                var propertyChanges = ParsePropertyChanges(row);

                results.Add(new ChangeEventDto(
                    Id: Guid.NewGuid().ToString(),
                    Timestamp: changeTime,
                    ChangeType: NormaliseChangeType(changeType),
                    ResourceId: resourceId,
                    ResourceName: string.IsNullOrWhiteSpace(resourceName) ? resourceId : resourceName,
                    ResourceType: FormatResourceType(resourceType),
                    ResourceGroup: resourceGroup,
                    SubscriptionId: subId,
                    ChangedBy: NormaliseChangedBy(changedBy, changedByType),
                    ChangedByType: changedByType,
                    ClientType: clientType,
                    CorrelationId: correlationId,
                    PropertyChanges: propertyChanges));
            }
            catch { /* skip malformed rows */ }
        }

        return results;
    }

    private static IReadOnlyList<PropertyChangeDto> ParsePropertyChanges(JsonElement row)
    {
        var list = new List<PropertyChangeDto>();
        if (!row.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Object)
            return list;

        foreach (var prop in changes.EnumerateObject())
        {
            var oldVal = prop.Value.TryGetProperty("previousValue", out var pv)
                ? pv.ValueKind == JsonValueKind.String ? pv.GetString() : pv.ToString()
                : null;
            var newVal = prop.Value.TryGetProperty("newValue", out var nv)
                ? nv.ValueKind == JsonValueKind.String ? nv.GetString() : nv.ToString()
                : null;

            // Skip noise: identical values or very long blobs
            if (string.Equals(oldVal, newVal, StringComparison.Ordinal)) continue;
            if ((oldVal?.Length ?? 0) > 500) oldVal = oldVal![..497] + "...";
            if ((newVal?.Length ?? 0) > 500) newVal = newVal![..497] + "...";

            list.Add(new PropertyChangeDto(prop.Name, oldVal, newVal));
            if (list.Count >= 20) break;
        }

        return list;
    }

    private static string GetString(JsonElement el, string key)
        => el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? string.Empty
            : string.Empty;

    private static string ExtractLastSegment(string resourceId)
    {
        if (string.IsNullOrWhiteSpace(resourceId)) return string.Empty;
        var parts = resourceId.TrimEnd('/').Split('/');
        return parts.Length > 0 ? parts[^1] : resourceId;
    }

    private static string FormatResourceType(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "Unknown";
        var parts = raw.Split('/');
        return parts.Length >= 2 ? $"{parts[0].Split('.').Last()}/{parts[1]}" : raw;
    }

    private static string NormaliseChangeType(string raw) => raw switch
    {
        "Create" or "create" => "Create",
        "Delete" or "delete" => "Delete",
        _                    => "Update",
    };

    private static string NormaliseChangedBy(string changedBy, string changedByType)
    {
        if (string.IsNullOrWhiteSpace(changedBy)) return changedByType ?? "System";
        // Shorten service principal GUIDs
        if (Guid.TryParse(changedBy, out _)) return $"ServicePrincipal ({changedBy[..8]}…)";
        return changedBy;
    }
}
