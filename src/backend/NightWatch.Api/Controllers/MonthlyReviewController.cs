using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Abstractions;
using System.Security.Claims;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/monthly-review")]
[Authorize(Policy = "NightWatchOperator")]
public sealed class MonthlyReviewController(
    IMonthlyReviewService reviewService,
    IEmailService emailService,
    IOperationsScopeService operationsScope,
    ITenantRegistryService tenantRegistry) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetReview(
        string tenantId, [FromQuery] string? month, CancellationToken ct)
    {
        var review = await reviewService.GetReviewAsync(tenantId, month, ct);
        return Ok(review);
    }

    [HttpGet("{tenantId}/action-items")]
    public async Task<IActionResult> GetActionItems(
        string tenantId, [FromQuery] string? month, CancellationToken ct)
    {
        var items = await reviewService.GetActionItemsAsync(tenantId, month, ct);
        return Ok(items);
    }

    [HttpPost("{tenantId}/action-items")]
    public async Task<IActionResult> CreateActionItem(
        string tenantId,
        [FromBody] CreateActionItemRequest request,
        [FromQuery] string? month,
        CancellationToken ct)
    {
        var targetMonth = month ?? DateTimeOffset.UtcNow.ToString("yyyy-MM");
        var item = await reviewService.CreateActionItemAsync(tenantId, targetMonth, request, ct);
        return CreatedAtAction(nameof(GetActionItems), new { tenantId }, item);
    }

    [HttpPut("{tenantId}/action-items/{id:int}")]
    public async Task<IActionResult> UpdateActionItem(
        string tenantId, int id,
        [FromBody] UpdateActionItemRequest request,
        CancellationToken ct)
    {
        var userEmail = User.FindFirstValue("preferred_username")
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue("name")
            ?? "unknown";

        var item = await reviewService.UpdateActionItemAsync(tenantId, id, request, userEmail, ct);
        return Ok(item);
    }

    [HttpDelete("{tenantId}/action-items/{id:int}")]
    public async Task<IActionResult> DeleteActionItem(
        string tenantId, int id, CancellationToken ct)
    {
        await reviewService.DeleteActionItemAsync(tenantId, id, ct);
        return NoContent();
    }

    [HttpGet("{tenantId}/generate-pdf")]
    public async Task<IActionResult> GeneratePdf(
        string tenantId, [FromQuery] string? month, CancellationToken ct)
    {
        var teamsSettings = operationsScope.GetTeamsSettings();
        var mspName = teamsSettings.CustomerName;

        string displayName;
        if (tenantId == "global")
            displayName = string.IsNullOrWhiteSpace(mspName) ? "Home Tenant" : mspName;
        else
        {
            var tenant = await tenantRegistry.GetTenantAsync(tenantId, ct);
            displayName = tenant?.DisplayName ?? tenantId;
        }

        var pdf = await reviewService.GenerateReviewPdfAsync(tenantId, month, mspName, ct);
        var safeMonth = month ?? DateTimeOffset.UtcNow.ToString("yyyy-MM");
        var safeName = displayName.Replace(" ", "-");
        var filename = $"NightWatch-MonthlyReview-{safeName}-{safeMonth}.pdf";
        return File(pdf, "application/pdf", filename);
    }

    [HttpPost("{tenantId}/send")]
    public async Task<IActionResult> SendReview(
        string tenantId, [FromBody] MonthlyReviewSendRequest request,
        [FromQuery] string? month, CancellationToken ct)
    {
        if (request.Recipients.Count == 0)
            return BadRequest("At least one recipient is required.");

        if (!emailService.IsConfigured)
            return BadRequest("SMTP is not configured. Add EmailSmtp settings to send email reports.");

        byte[] pdf;
        try
        {
            var mspName = operationsScope.GetTeamsSettings().CustomerName;
            pdf = await reviewService.GenerateReviewPdfAsync(tenantId, month, mspName, ct);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Report generation failed: {ex.Message}");
        }

        var teamsSettings = operationsScope.GetTeamsSettings();
        var targetMonth = month ?? DateTimeOffset.UtcNow.ToString("MMMM yyyy");
        string tenantDisplay;
        if (tenantId == "global")
            tenantDisplay = string.IsNullOrWhiteSpace(teamsSettings.CustomerName) ? "Home Tenant" : teamsSettings.CustomerName;
        else
        {
            var tenant = await tenantRegistry.GetTenantAsync(tenantId, ct);
            tenantDisplay = tenant?.DisplayName ?? tenantId;
        }

        var subject = $"{tenantDisplay} — Monthly Review Report — {targetMonth}";
        var htmlBody = BuildEmailBody(tenantDisplay, targetMonth);
        var filename = $"NightWatch-MonthlyReview-{tenantDisplay.Replace(" ", "-")}-{DateTimeOffset.UtcNow:yyyy-MM}.pdf";

        var sent = await emailService.SendReportAsync(request.Recipients.ToList(), subject, htmlBody, pdf, filename, ct);

        return Ok(new
        {
            sent,
            recipients = request.Recipients.Count,
            fileSizeKb = pdf.Length / 1024,
            sentAt = DateTimeOffset.UtcNow
        });
    }

    private static string BuildEmailBody(string name, string month) => $"""
        <html><body style="font-family:system-ui,sans-serif;color:#1e293b;max-width:600px;margin:40px auto;padding:0 20px">
          <h2>{name} — Monthly Review — {month}</h2>
          <p>Please find your monthly Azure operations review report attached.</p>
          <p>This report includes month-on-month score comparisons, trend analysis, and open action items.</p>
          <p style="font-size:12px;color:#94a3b8">Generated by NightWatch — Azure Operations Intelligence</p>
        </body></html>
        """;
}
