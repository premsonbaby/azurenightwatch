namespace NightWatch.Infrastructure.Abstractions;

public sealed record AiTargetSettings(
    string Target,
    string Endpoint,
    string Model,
    string ApiKey);

public sealed record AiUsageMonthSummary(
    string MonthKey,
    long PromptTokens,
    long CompletionTokens,
    decimal EstimatedCostUsd,
    DateTimeOffset? LastUpdatedUtc)
{
    public long TotalTokens => PromptTokens + CompletionTokens;
}

public sealed record AiUsageRateSummary(
    decimal InputTokenCostPer1kUsd,
    decimal OutputTokenCostPer1kUsd);

public sealed record OperationsScopeSettings(
    IReadOnlyList<string> SubscriptionIds,
    IReadOnlyList<string> LogAnalyticsWorkspaceIds,
    AiTargetSettings AiTarget,
    AiUsageMonthSummary AiUsage,
    AiUsageRateSummary AiUsageRates,
    DrScopeSettings DrSettings,
    bool AiSummaryEnabled,
    DateTimeOffset UpdatedAtUtc);

public sealed record DrComplianceThresholdsSettings(
    decimal GreenPercent,
    decimal AmberPercent,
    decimal RedPercent,
    decimal NearBreachPercent);

public sealed record DrCriticalityProfileSettings(
    string Name,
    int DesiredRpoMinutes,
    int DesiredRtoMinutes);

public sealed record DrTargetOverrideSettings(
    string ScopeType,
    string ScopeId,
    string WorkloadType,
    string ResourceId,
    string Criticality,
    int DesiredRpoMinutes,
    int DesiredRtoMinutes);

public sealed record DrScopeSettings(
    int GlobalDesiredRpoMinutes,
    int GlobalDesiredRtoMinutes,
    DrComplianceThresholdsSettings Thresholds,
    IReadOnlyCollection<DrCriticalityProfileSettings> CriticalityProfiles,
    IReadOnlyCollection<DrTargetOverrideSettings> Overrides);

public sealed record TeamsNotificationSettings(
    string WebhookUrl,
    bool DailyReportEnabled,
    string DailyReportTime,         // HH:mm
    string TimeZone,                // IANA or Windows TZ id
    bool AlertsEnabled,
    string CustomerName = "",
    bool TeamsAiSummaryEnabled = false,
    string? CustomerWebhookUrl = null,
    bool CustomerWebhookEnabled = false);

public interface IOperationsScopeService
{
    OperationsScopeSettings GetCurrent();
    OperationsScopeSettings Update(
        string? subscriptionId,
        IReadOnlyList<string>? logAnalyticsWorkspaceIds,
        string? aiTarget,
        string? aiEndpoint,
        string? aiModel,
        string? aiApiKey,
        DrScopeSettings? drSettings,
        bool? aiSummaryEnabled = null);

    void RecordAiUsage(AiUsageSample usageSample);
    string? GetAiBriefingPrompt();
    void SetAiBriefingPrompt(string? prompt);

    TeamsNotificationSettings GetTeamsSettings();
    Task SaveTeamsSettingsAsync(TeamsNotificationSettings settings, CancellationToken ct);
    Task<DateTimeOffset?> GetTeamsLastReportSentAtAsync(CancellationToken ct);
    Task SetTeamsLastReportSentAtAsync(DateTimeOffset sentAt, CancellationToken ct);
    Task<string> GetTeamsAlertStateJsonAsync(CancellationToken ct);
    Task SetTeamsAlertStateJsonAsync(string json, CancellationToken ct);
}
