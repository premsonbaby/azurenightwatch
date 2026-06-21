using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Persistence;
using System.Globalization;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

/// <summary>
/// Polls every 5 minutes. For each active customer with a report schedule,
/// checks whether it's time to send and dispatches a PDF report via email.
/// </summary>
public sealed class ScheduledEmailReportBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<ScheduledEmailReportBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(3), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await CheckAndSendAllAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { logger.LogError(ex, "Scheduled email report service error."); }

            try { await Task.Delay(CheckInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task CheckAndSendAllAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NightWatchDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

        if (!emailService.IsConfigured) return;

        var tenants = await db.CustomerTenants
            .Where(t => t.IsActive && t.ReportScheduleJson != null)
            .ToListAsync(ct);

        foreach (var tenant in tenants)
        {
            if (ct.IsCancellationRequested) break;

            var config = DeserializeConfig(tenant.ReportScheduleJson);
            if (!config.Enabled || config.Recipients.Count == 0) continue;

            var tz = ResolveTimeZone(config.TimeZone);
            var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);

            if (!IsDueNow(config, nowLocal)) continue;

            // Deduplication — check last sent (compare date in tenant's timezone)
            if (tenant.ReportLastSentAt.HasValue)
            {
                var lastLocal = TimeZoneInfo.ConvertTime(tenant.ReportLastSentAt.Value, tz);
                var duePeriodStart = GetCurrentPeriodStart(config, nowLocal);
                if (lastLocal >= duePeriodStart) continue;
            }

            logger.LogInformation("Sending scheduled report for tenant {TenantId} ({Name}).",
                tenant.TenantId, tenant.DisplayName);

            await SendReportForTenantAsync(scope, tenant.TenantId, tenant.DisplayName, config, ct);

            // Record send time
            tenant.ReportLastSentAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    private async Task SendReportForTenantAsync(
        IServiceScope scope,
        string tenantId,
        string displayName,
        ReportScheduleConfig config,
        CancellationToken ct)
    {
        var reportService = scope.ServiceProvider.GetRequiredService<IReportService>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var scheduleService = scope.ServiceProvider.GetRequiredService<IReportScheduleService>();

        byte[] pdf = [];
        string status = "Failed";
        string? error = null;

        try
        {
            var options = new ReportOptions(config.IncludeAiSummary, displayName);
            pdf = await reportService.GeneratePdfReportAsync(tenantId, options, ct);

            var month = DateTimeOffset.UtcNow.ToString("MMMM yyyy", CultureInfo.InvariantCulture);
            var subject = $"{displayName} — Azure Operations Report — {month}";
            var htmlBody = BuildEmailBody(displayName, month);
            var filename = $"NightWatch-Report-{displayName.Replace(" ", "-")}-{DateTimeOffset.UtcNow:yyyy-MM}.pdf";

            var sent = await emailService.SendReportAsync(config.Recipients, subject, htmlBody, pdf, filename, ct);
            status = sent ? "Sent" : "Failed";
            if (!sent) error = "SMTP delivery failed.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Report generation/send failed for {TenantId}.", tenantId);
            error = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
        }

        await scheduleService.LogSendAsync(
            tenantId, displayName, config.Recipients.Count,
            status, error, pdf.Length, "Email", ct);
    }

    private static string BuildEmailBody(string customerName, string month) => $"""
        <html><body style="font-family:system-ui,sans-serif;color:#1e293b;max-width:600px;margin:40px auto;padding:0 20px">
          <div style="background:#0f172a;border-radius:12px;padding:24px 28px;margin-bottom:24px">
            <h1 style="color:#67e8f9;font-size:20px;margin:0 0 4px">Azure Night Watch</h1>
            <p style="color:#94a3b8;margin:0;font-size:13px">Operations Intelligence Report</p>
          </div>
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">{customerName}</h2>
          <p style="color:#475569;font-size:14px;margin:0 0 20px">{month} Operations Report</p>
          <p style="font-size:14px;line-height:1.6;color:#334155">
            Please find your monthly Azure operations report attached as a PDF.
            This report covers security posture, cost efficiency, governance compliance,
            performance metrics, and actionable recommendations for {customerName}.
          </p>
          <p style="font-size:12px;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px">
            Generated by NightWatch — Azure Operations Intelligence<br>
            This is an automated report. Do not reply to this email.
          </p>
        </body></html>
        """;

    private static bool IsDueNow(ReportScheduleConfig config, DateTimeOffset nowLocal)
    {
        if (!TimeOnly.TryParse(config.SendTime, out var targetTime))
            targetTime = new TimeOnly(9, 0);

        if (nowLocal.Hour < targetTime.Hour ||
            (nowLocal.Hour == targetTime.Hour && nowLocal.Minute < targetTime.Minute))
            return false;

        return config.Frequency switch
        {
            "Monthly" => nowLocal.Day == config.DayOfMonth,
            "Weekly" => string.Equals(nowLocal.DayOfWeek.ToString(), config.DayOfWeek,
                StringComparison.OrdinalIgnoreCase),
            _ => false
        };
    }

    private static DateTimeOffset GetCurrentPeriodStart(ReportScheduleConfig config, DateTimeOffset nowLocal)
    {
        return config.Frequency switch
        {
            "Monthly" => new DateTimeOffset(nowLocal.Year, nowLocal.Month, config.DayOfMonth, 0, 0, 0, nowLocal.Offset),
            "Weekly" => nowLocal.AddDays(-(int)nowLocal.DayOfWeek).Date == nowLocal.Date
                ? nowLocal.Date
                : nowLocal.AddDays(-7),
            _ => nowLocal.AddDays(-1)
        };
    }

    private static TimeZoneInfo ResolveTimeZone(string tzId)
    {
        if (string.IsNullOrWhiteSpace(tzId)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); }
        catch { return TimeZoneInfo.Utc; }
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private static ReportScheduleConfig DeserializeConfig(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new ReportScheduleConfig();
        try { return JsonSerializer.Deserialize<ReportScheduleConfig>(json, JsonOpts) ?? new ReportScheduleConfig(); }
        catch { return new ReportScheduleConfig(); }
    }

    private sealed class ReportScheduleConfig
    {
        public bool Enabled { get; set; }
        public string Frequency { get; set; } = "Monthly";
        public int DayOfMonth { get; set; } = 1;
        public string DayOfWeek { get; set; } = "Monday";
        public string SendTime { get; set; } = "09:00";
        public string TimeZone { get; set; } = "UTC";
        public List<string> Recipients { get; set; } = [];
        public bool IncludeAiSummary { get; set; } = true;
    }
}
