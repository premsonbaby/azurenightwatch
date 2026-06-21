namespace NightWatch.Infrastructure.Abstractions;

public sealed record AiUsageSample(
    long PromptTokens,
    long CompletionTokens,
    decimal EstimatedCostUsd,
    DateTimeOffset OccurredAtUtc);

public sealed record AiSummaryResult(
    string Summary,
    AiUsageSample? Usage);

public interface IAiSummaryService
{
    Task<AiSummaryResult> SummarizeWithUsageAsync(
        string fullDashboardJson,
        AiTargetSettings aiTarget,
        CancellationToken cancellationToken);

    Task<string> SummarizeAsync(
        string fullDashboardJson,
        AiTargetSettings aiTarget,
        CancellationToken cancellationToken);
}
