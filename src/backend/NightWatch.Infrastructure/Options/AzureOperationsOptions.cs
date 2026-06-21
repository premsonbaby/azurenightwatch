namespace NightWatch.Infrastructure.Options;

public sealed class AzureOperationsOptions
{
    public const string SectionName = "AzureOperations";

    public string ManagementEndpoint { get; set; } = "https://management.azure.com";
    public string MonitorEndpoint { get; set; } = "https://api.loganalytics.io";
    public string LogAnalyticsWorkspaceId { get; set; } = string.Empty;
    public List<string> LogAnalyticsWorkspaceIds { get; set; } = [];
    public List<string> SubscriptionIds { get; set; } = [];
    public string AiTarget { get; set; } = "none";
    public string AiEndpoint { get; set; } = string.Empty;
    public string AiModel { get; set; } = string.Empty;
    public string AiApiKey { get; set; } = string.Empty;
    public decimal AiInputTokenCostPer1kUsd { get; set; } = 0.002m;
    public decimal AiOutputTokenCostPer1kUsd { get; set; } = 0.008m;
}
