namespace NightWatch.Application.Contracts;

public sealed record AlertThresholdDto(
    int Id,
    string TenantId,
    string MetricType,
    decimal ThresholdValue,
    string AlertChannel,
    bool IsEnabled,
    string? TeamsWebhookUrl,
    string? AlertEmail,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public sealed record ThresholdBreachDto(
    int Id,
    int ThresholdId,
    string TenantId,
    string MetricType,
    decimal ThresholdValue,
    decimal ActualValue,
    DateTimeOffset BreachedAt,
    DateTimeOffset? ResolvedAt,
    string? AlertTitle,
    string? BusinessImpact,
    string? SuggestedAction,
    string Severity,
    bool IsAcknowledged,
    DateTimeOffset? AcknowledgedAt,
    string? AcknowledgedBy
);

public sealed record UpsertThresholdRequest(
    string MetricType,
    decimal ThresholdValue,
    string AlertChannel,
    bool IsEnabled,
    string? TeamsWebhookUrl = null,
    string? AlertEmail = null
);

public sealed record AcknowledgeBreachRequest(string AcknowledgedBy);
