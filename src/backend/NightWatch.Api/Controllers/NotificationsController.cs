using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Services;
using Microsoft.Extensions.Hosting;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(
    IOperationsScopeService operationsScope,
    TeamsNotificationService teamsService,
    IEnumerable<IHostedService> hostedServices) : ControllerBase
{
    [HttpGet("teams")]
    public IActionResult GetTeamsSettings()
    {
        var settings = operationsScope.GetTeamsSettings();
        return Ok(new
        {
            webhookUrl = settings.WebhookUrl,
            dailyReportEnabled = settings.DailyReportEnabled,
            dailyReportTime = settings.DailyReportTime,
            timeZone = settings.TimeZone,
            alertsEnabled = settings.AlertsEnabled,
            customerName = settings.CustomerName,
            teamsAiSummaryEnabled = settings.TeamsAiSummaryEnabled,
            customerWebhookUrl = settings.CustomerWebhookUrl,
            customerWebhookEnabled = settings.CustomerWebhookEnabled
        });
    }

    [HttpPut("teams")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> SaveTeamsSettings(
        [FromBody] TeamsSettingsRequest request,
        CancellationToken ct)
    {
        var settings = new TeamsNotificationSettings(
            WebhookUrl: request.WebhookUrl?.Trim() ?? "",
            DailyReportEnabled: request.DailyReportEnabled,
            DailyReportTime: request.DailyReportTime?.Trim() ?? "09:00",
            TimeZone: request.TimeZone?.Trim() ?? "UTC",
            AlertsEnabled: request.AlertsEnabled,
            CustomerName: request.CustomerName?.Trim() ?? "",
            TeamsAiSummaryEnabled: request.TeamsAiSummaryEnabled,
            CustomerWebhookUrl: string.IsNullOrWhiteSpace(request.CustomerWebhookUrl) ? null : request.CustomerWebhookUrl.Trim(),
            CustomerWebhookEnabled: request.CustomerWebhookEnabled);

        await operationsScope.SaveTeamsSettingsAsync(settings, ct);
        return Ok(new { success = true });
    }

    [HttpGet("teams/status")]
    public async Task<IActionResult> GetTeamsStatus()
    {
        var reportService = hostedServices.OfType<TeamsReportBackgroundService>().FirstOrDefault();
        if (reportService == null)
            return StatusCode(503, new { error = "Report service not available." });

        var status = await reportService.GetStatusAsync();
        return Ok(status);
    }

    [HttpPost("teams/reset-last-sent")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> ResetLastSent(CancellationToken ct)
    {
        await operationsScope.SetTeamsLastReportSentAtAsync(DateTimeOffset.MinValue, ct);
        return Ok(new { success = true, message = "Last sent timestamp cleared. Auto-trigger will fire next time scheduled time passes." });
    }

    [HttpPost("teams/send-report")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> SendReportNow(CancellationToken ct)
    {
        var settings = operationsScope.GetTeamsSettings();
        if (string.IsNullOrWhiteSpace(settings.WebhookUrl))
            return BadRequest(new { error = "No webhook URL configured." });

        var reportService = hostedServices.OfType<TeamsReportBackgroundService>().FirstOrDefault();
        if (reportService == null)
            return StatusCode(503, new { error = "Report service not available." });

        await reportService.SendReportAsync(settings, ct);
        return Ok(new { success = true });
    }

    [HttpPost("teams/test")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> SendTestNotification(
        [FromBody] TestNotificationRequest request,
        CancellationToken ct)
    {
        var webhookUrl = request.WebhookUrl?.Trim();
        if (string.IsNullOrWhiteSpace(webhookUrl))
        {
            var existing = operationsScope.GetTeamsSettings();
            webhookUrl = existing.WebhookUrl;
        }

        if (string.IsNullOrWhiteSpace(webhookUrl))
            return BadRequest(new { error = "No webhook URL configured." });

        var sent = await teamsService.SendTestMessageAsync(webhookUrl, ct);
        return Ok(new { success = sent });
    }
}

public sealed record TeamsSettingsRequest(
    string? WebhookUrl,
    bool DailyReportEnabled,
    string? DailyReportTime,
    string? TimeZone,
    bool AlertsEnabled,
    string? CustomerName = null,
    bool TeamsAiSummaryEnabled = false,
    string? CustomerWebhookUrl = null,
    bool CustomerWebhookEnabled = false);

public sealed record TestNotificationRequest(string? WebhookUrl);
