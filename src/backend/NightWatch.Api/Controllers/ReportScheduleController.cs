using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/report-schedule")]
[Authorize(Policy = "NightWatchOperator")]
public sealed class ReportScheduleController(
    IReportScheduleService scheduleService,
    IReportService reportService,
    IEmailService emailService,
    IOperationsScopeService operationsScope,
    ITenantRegistryService tenantRegistry) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetSchedule(string tenantId, CancellationToken ct)
    {
        var schedule = await scheduleService.GetScheduleAsync(tenantId, ct);
        return Ok(schedule);
    }

    [HttpPut("{tenantId}")]
    public async Task<IActionResult> UpsertSchedule(
        string tenantId, [FromBody] UpsertReportScheduleRequest request, CancellationToken ct)
    {
        if (request.Frequency is not ("Monthly" or "Weekly"))
            return BadRequest("Frequency must be Monthly or Weekly.");
        if (request.Recipients.Count == 0)
            return BadRequest("At least one recipient email is required.");

        var schedule = await scheduleService.UpsertScheduleAsync(tenantId, request, ct);
        return Ok(schedule);
    }

    [HttpGet("{tenantId}/history")]
    public async Task<IActionResult> GetHistory(
        string tenantId, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        var history = await scheduleService.GetHistoryAsync(tenantId, Math.Clamp(limit, 1, 200), ct);
        return Ok(history);
    }

    [HttpGet("history/all")]
    public async Task<IActionResult> GetAllHistory(
        [FromQuery] int limit = 100, CancellationToken ct = default)
    {
        var history = await scheduleService.GetAllHistoryAsync(Math.Clamp(limit, 1, 500), ct);
        return Ok(history);
    }

    [HttpPost("{tenantId}/send-now")]
    public async Task<IActionResult> SendNow(string tenantId, CancellationToken ct)
    {
        var schedule = await scheduleService.GetScheduleAsync(tenantId, ct);

        if (schedule.Recipients.Count == 0)
            return BadRequest("No recipients configured. Add at least one email address in the schedule settings.");

        if (!emailService.IsConfigured)
            return BadRequest("SMTP is not configured on this server. Add EmailSmtp settings to send email reports.");

        var teamsSettings = operationsScope.GetTeamsSettings();
        var mspName = teamsSettings.CustomerName;
        string tenantDisplay;
        if (tenantId == "global")
            tenantDisplay = string.IsNullOrWhiteSpace(mspName) ? "Home Tenant" : mspName;
        else
        {
            var tenant = await tenantRegistry.GetTenantAsync(tenantId, ct);
            tenantDisplay = tenant?.DisplayName ?? tenantId;
        }

        byte[] pdf;
        try
        {
            var options = new ReportOptions(
                AiEnabled: schedule.IncludeAiSummary,
                TenantDisplayName: tenantDisplay,
                MspName: mspName);

            pdf = await reportService.GeneratePdfReportAsync(tenantId, options, ct);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Report generation failed: {ex.Message}");
        }

        var month = DateTimeOffset.UtcNow.ToString("MMMM yyyy");
        var subject = $"{tenantDisplay} — Azure Operations Report — {month}";
        var htmlBody = BuildSimpleEmailBody(tenantDisplay, month);
        var filename = $"NightWatch-Report-{tenantDisplay.Replace(" ", "-")}-{DateTimeOffset.UtcNow:yyyy-MM}.pdf";

        var sent = await emailService.SendReportAsync(schedule.Recipients, subject, htmlBody, pdf, filename, ct);

        await scheduleService.LogSendAsync(
            tenantId, tenantDisplay, schedule.Recipients.Count,
            sent ? "Sent" : "Failed",
            sent ? null : "Manual send failed.",
            pdf.Length, "OnDemand", ct);

        return Ok(new
        {
            sent,
            recipients = schedule.Recipients.Count,
            fileSizeKb = pdf.Length / 1024,
            sentAt = DateTimeOffset.UtcNow
        });
    }

    [HttpPost("{tenantId}/resend/{logId:int}")]
    public async Task<IActionResult> ResendReport(string tenantId, int logId, CancellationToken ct)
    {
        // Load history to find the original recipients from the schedule
        var schedule = await scheduleService.GetScheduleAsync(tenantId, ct);
        if (schedule.Recipients.Count == 0)
            return BadRequest("No recipients configured. Add at least one email address in the schedule settings.");

        if (!emailService.IsConfigured)
            return BadRequest("SMTP is not configured on this server.");

        var teamsSettings = operationsScope.GetTeamsSettings();
        var mspName = teamsSettings.CustomerName;
        string tenantDisplay;
        if (tenantId == "global")
            tenantDisplay = string.IsNullOrWhiteSpace(mspName) ? "Home Tenant" : mspName;
        else
        {
            var tenant = await tenantRegistry.GetTenantAsync(tenantId, ct);
            tenantDisplay = tenant?.DisplayName ?? tenantId;
        }

        byte[] pdf;
        try
        {
            var options = new ReportOptions(
                AiEnabled: schedule.IncludeAiSummary,
                TenantDisplayName: tenantDisplay,
                MspName: mspName);
            pdf = await reportService.GeneratePdfReportAsync(tenantId, options, ct);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Report generation failed: {ex.Message}");
        }

        var month = DateTimeOffset.UtcNow.ToString("MMMM yyyy");
        var subject = $"{tenantDisplay} — Azure Operations Report (Resent) — {month}";
        var htmlBody = BuildSimpleEmailBody(tenantDisplay, month, resent: true);
        var filename = $"NightWatch-Report-{tenantDisplay.Replace(" ", "-")}-{DateTimeOffset.UtcNow:yyyy-MM}.pdf";

        var sent = await emailService.SendReportAsync(schedule.Recipients, subject, htmlBody, pdf, filename, ct);

        await scheduleService.LogSendAsync(
            tenantId, tenantDisplay, schedule.Recipients.Count,
            sent ? "Sent" : "Failed",
            sent ? null : "Resend failed.",
            pdf.Length, "OnDemand", ct);

        return Ok(new
        {
            sent,
            recipients = schedule.Recipients.Count,
            fileSizeKb = pdf.Length / 1024,
            sentAt = DateTimeOffset.UtcNow
        });
    }

    private static string BuildSimpleEmailBody(string name, string month, bool resent = false) => $"""
        <html><body style="font-family:system-ui,sans-serif;color:#1e293b;max-width:600px;margin:40px auto;padding:0 20px">
          <h2>{name} — {month} Report</h2>
          <p>Please find your Azure operations report attached{(resent ? " (this is a resent copy)" : "")}.</p>
          <p style="font-size:12px;color:#94a3b8">Generated by NightWatch — Azure Operations Intelligence</p>
        </body></html>
        """;
}
