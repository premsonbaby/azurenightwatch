using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Infrastructure.Services;

public sealed class TeamsReportBackgroundService(
    IServiceScopeFactory scopeFactory,
    IOperationsScopeService operationsScope,
    ILogger<TeamsReportBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Teams daily report service started.");
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndSendAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unhandled error in Teams daily report service.");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task CheckAndSendAsync(CancellationToken ct)
    {
        var settings = operationsScope.GetTeamsSettings();
        if (!settings.DailyReportEnabled || string.IsNullOrWhiteSpace(settings.WebhookUrl))
            return;

        var tz = ResolveTimeZone(settings.TimeZone);
        var nowUtc = DateTimeOffset.UtcNow;
        var nowLocal = TimeZoneInfo.ConvertTime(nowUtc, tz);

        if (!TimeOnly.TryParse(settings.DailyReportTime, out var targetTime))
            targetTime = new TimeOnly(9, 0);

        // Target = configured time today in the configured timezone
        var targetLocal = new DateTimeOffset(
            nowLocal.Year, nowLocal.Month, nowLocal.Day,
            targetTime.Hour, targetTime.Minute, 0,
            tz.GetUtcOffset(nowLocal.DateTime));

        // Not yet time today
        if (nowUtc < targetLocal.ToUniversalTime())
            return;

        // Already sent today — check by comparing dates in the configured timezone
        var lastSent = await operationsScope.GetTeamsLastReportSentAtAsync(ct);
        if (lastSent.HasValue)
        {
            var lastSentLocal = TimeZoneInfo.ConvertTime(lastSent.Value, tz);
            if (lastSentLocal.Date >= nowLocal.Date)
            {
                logger.LogDebug("Teams daily report already sent today ({Date}), skipping.", lastSentLocal.Date);
                return;
            }
        }

        // Scheduled time has passed today and we haven't sent yet — send now (catch-up safe)
        logger.LogInformation("Sending Teams daily report — now {Now}, scheduled {Target}", nowLocal.ToString("HH:mm"), targetLocal.ToString("HH:mm"));
        await SendReportAsync(settings, ct);
    }

    public async Task<object> GetStatusAsync()
    {
        var settings = operationsScope.GetTeamsSettings();
        var tz = ResolveTimeZone(settings.TimeZone);
        var nowUtc = DateTimeOffset.UtcNow;
        var nowLocal = TimeZoneInfo.ConvertTime(nowUtc, tz);

        if (!TimeOnly.TryParse(settings.DailyReportTime, out var targetTime))
            targetTime = new TimeOnly(9, 0);

        var targetLocal = new DateTimeOffset(
            nowLocal.Year, nowLocal.Month, nowLocal.Day,
            targetTime.Hour, targetTime.Minute, 0,
            tz.GetUtcOffset(nowLocal.DateTime));

        var lastSent = await operationsScope.GetTeamsLastReportSentAtAsync(CancellationToken.None);

        string sentTodayStatus;
        if (lastSent == null)
            sentTodayStatus = "No — never sent";
        else
        {
            var lastSentLocal = TimeZoneInfo.ConvertTime(lastSent.Value, tz);
            sentTodayStatus = lastSentLocal.Date >= nowLocal.Date
                ? $"Yes — sent at {lastSentLocal:HH:mm}"
                : $"No — last sent {lastSentLocal:yyyy-MM-dd HH:mm}";
        }

        var nextSend = targetLocal < nowLocal ? targetLocal.AddDays(1) : targetLocal;

        return new
        {
            serverTimeUtc = nowUtc.ToString("yyyy-MM-dd HH:mm:ss zzz"),
            localTime = nowLocal.ToString("yyyy-MM-dd HH:mm:ss zzz"),
            configuredTimeZone = settings.TimeZone,
            resolvedTimeZone = tz.Id,
            configuredReportTime = settings.DailyReportTime,
            scheduledTimeToday = targetLocal.ToString("yyyy-MM-dd HH:mm:ss zzz"),
            nextScheduledSend = nextSend.ToString("yyyy-MM-dd HH:mm:ss zzz"),
            sentToday = sentTodayStatus,
            lastSentUtc = lastSent?.ToString("yyyy-MM-dd HH:mm:ss zzz") ?? "Never",
            dailyReportEnabled = settings.DailyReportEnabled,
            webhookConfigured = !string.IsNullOrWhiteSpace(settings.WebhookUrl),
            customerName = settings.CustomerName
        };
    }

    public async Task SendReportAsync(TeamsNotificationSettings settings, CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var teamsService = scope.ServiceProvider.GetRequiredService<TeamsNotificationService>();
            var insightAggregator = scope.ServiceProvider.GetRequiredService<IInsightAggregatorService>();
            var aiService = scope.ServiceProvider.GetService<IAiSummaryService>();
            var scopeSettings = operationsScope.GetCurrent();

            IReadOnlyList<InsightDto> insights = [];
            try
            {
                var all = await insightAggregator.GetCriticalInsightsAsync();
                insights = all.Take(20).ToList();
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not fetch insights for Teams daily report.");
            }

            string? aiSummary = null;
            if (settings.TeamsAiSummaryEnabled && aiService != null && scopeSettings.AiTarget.Target != "none")
            {
                try
                {
                    var critical = insights.Count(x => x.Severity == SeverityLevel.Critical);
                    var high = insights.Count(x => x.Severity == SeverityLevel.High);
                    var topTitles = insights
                        .Where(x => x.Severity <= SeverityLevel.High)
                        .Take(5)
                        .Select(x => $"- [{x.Category}] {x.Title}");

                    var prompt = $"""
                        You are a concise Azure operations briefing assistant.
                        Write a 2-3 sentence executive summary suitable for a Microsoft Teams card.
                        Be direct and actionable. Do not use bullet points or markdown headers.

                        Data: {critical} critical findings, {high} high findings today.
                        Top issues:
                        {string.Join("\n", topTitles)}

                        Summary:
                        """;

                    aiSummary = await aiService.SummarizeAsync(prompt, scopeSettings.AiTarget, ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "AI summary for Teams report failed, sending without it.");
                }
            }

            var sent = await teamsService.SendDailyReportAsync(
                settings.WebhookUrl, scopeSettings, insights, aiSummary, settings.CustomerName, ct);

            if (sent)
            {
                await operationsScope.SetTeamsLastReportSentAtAsync(DateTimeOffset.UtcNow, ct);
                logger.LogInformation("Teams daily report sent successfully.");
            }
            else
            {
                logger.LogWarning("Teams daily report webhook returned a failure response.");
            }

            // Fan out to customer webhook if configured
            if (settings.CustomerWebhookEnabled && !string.IsNullOrWhiteSpace(settings.CustomerWebhookUrl))
            {
                try
                {
                    await teamsService.SendDailyReportAsync(
                        settings.CustomerWebhookUrl, scopeSettings, insights, aiSummary, settings.CustomerName, ct);
                    logger.LogInformation("Teams daily report also sent to customer webhook.");
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to send Teams daily report to customer webhook.");
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send Teams daily report.");
        }
    }

    private static TimeZoneInfo ResolveTimeZone(string tzId)
    {
        if (string.IsNullOrWhiteSpace(tzId)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); }
        catch { return TimeZoneInfo.Utc; }
    }
}
