namespace NightWatch.Infrastructure.Persistence.Entities;

public sealed class GlobalOperationsConfigEntity
{
    public Guid Id { get; set; }
    public string ScopeKey { get; set; } = "global";
    public string SubscriptionId { get; set; } = string.Empty;
    public string LogAnalyticsWorkspaceId { get; set; } = string.Empty;
    public string AiTarget { get; set; } = "none";
    public string AiEndpoint { get; set; } = string.Empty;
    public string AiModel { get; set; } = string.Empty;
    public string AiApiKey { get; set; } = string.Empty;
    public string AiUsageMonthKey { get; set; } = string.Empty;
    public long AiPromptTokens { get; set; }
    public long AiCompletionTokens { get; set; }
    public decimal AiEstimatedCostUsd { get; set; }
    public DateTimeOffset? AiUsageUpdatedAtUtc { get; set; }
    public string DrSettingsJson { get; set; } = string.Empty;
    public string AiBriefingPrompt { get; set; } = string.Empty;
    public string TeamsSettingsJson { get; set; } = string.Empty;
    public DateTimeOffset? TeamsLastReportSentAt { get; set; }
    public string TeamsAlertStateJson { get; set; } = string.Empty;
    public bool AiSummaryEnabled { get; set; }
    public string? ReportScheduleJson { get; set; }
    public DateTimeOffset? ReportLastSentAt { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
