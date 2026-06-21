using Microsoft.EntityFrameworkCore;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed class ReportScheduleService(
    NightWatchDbContext db,
    IEmailService emailService) : IReportScheduleService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };
    private const string HomeTenantId = "global";

    public async Task<ReportScheduleDto> GetScheduleAsync(string tenantId, CancellationToken ct)
    {
        if (tenantId == HomeTenantId)
        {
            var config = await GetHomeConfigAsync(ct);
            var homeSchedule = Deserialize(config?.ReportScheduleJson);
            return ToDto(tenantId, homeSchedule, config?.ReportLastSentAt);
        }

        var tenant = await db.CustomerTenants
            .FirstOrDefaultAsync(t => t.TenantId == tenantId, ct);
        var schedule = Deserialize(tenant?.ReportScheduleJson);
        return ToDto(tenantId, schedule, tenant?.ReportLastSentAt);
    }

    public async Task<ReportScheduleDto> UpsertScheduleAsync(string tenantId, UpsertReportScheduleRequest request, CancellationToken ct)
    {
        var config = new ReportScheduleConfig
        {
            Enabled = request.Enabled,
            Frequency = request.Frequency,
            DayOfMonth = Math.Clamp(request.DayOfMonth, 1, 28),
            DayOfWeek = request.DayOfWeek,
            SendTime = request.SendTime,
            TimeZone = string.IsNullOrWhiteSpace(request.TimeZone) ? "UTC" : request.TimeZone,
            Recipients = request.Recipients.Where(r => !string.IsNullOrWhiteSpace(r)).ToList(),
            IncludeAiSummary = request.IncludeAiSummary,
        };
        var json = JsonSerializer.Serialize(config);

        if (tenantId == HomeTenantId)
        {
            var homeConfig = await GetHomeConfigAsync(ct)
                ?? throw new InvalidOperationException("Global operations config not found.");
            homeConfig.ReportScheduleJson = json;
            await db.SaveChangesAsync(ct);
            return await GetScheduleAsync(tenantId, ct);
        }

        var tenant = await db.CustomerTenants
            .FirstOrDefaultAsync(t => t.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException($"Tenant {tenantId} not found.");
        tenant.ReportScheduleJson = json;
        await db.SaveChangesAsync(ct);
        return await GetScheduleAsync(tenantId, ct);
    }

    public async Task<IReadOnlyList<ReportSentLogDto>> GetHistoryAsync(string tenantId, int maxRows, CancellationToken ct)
    {
        var rows = await db.ReportSentLogs
            .Where(r => r.TenantId == tenantId)
            .OrderByDescending(r => r.SentAt)
            .Take(Math.Clamp(maxRows, 1, 200))
            .ToListAsync(ct);
        return rows.Select(ToLogDto).ToList();
    }

    public async Task<IReadOnlyList<ReportSentLogDto>> GetAllHistoryAsync(int maxRows, CancellationToken ct)
    {
        var rows = await db.ReportSentLogs
            .OrderByDescending(r => r.SentAt)
            .Take(Math.Clamp(maxRows, 1, 500))
            .ToListAsync(ct);
        return rows.Select(ToLogDto).ToList();
    }

    public async Task LogSendAsync(string tenantId, string displayName, int recipientCount, string status, string? error, long fileSizeBytes, string reportType, CancellationToken ct)
    {
        db.ReportSentLogs.Add(new ReportSentLogEntity
        {
            TenantId = tenantId,
            DisplayName = displayName,
            SentAt = DateTimeOffset.UtcNow,
            RecipientCount = recipientCount,
            Status = status,
            ErrorMessage = error,
            FileSizeBytes = fileSizeBytes,
            ReportType = reportType,
        });

        // Update LastSentAt on the owning record
        if (tenantId == HomeTenantId)
        {
            var homeConfig = await GetHomeConfigAsync(ct);
            if (homeConfig is not null) homeConfig.ReportLastSentAt = DateTimeOffset.UtcNow;
        }
        else
        {
            var tenant = await db.CustomerTenants.FirstOrDefaultAsync(t => t.TenantId == tenantId, ct);
            if (tenant is not null) tenant.ReportLastSentAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<GlobalOperationsConfigEntity?> GetHomeConfigAsync(CancellationToken ct) =>
        await db.GlobalOperationsConfigs.FirstOrDefaultAsync(ct);

    private ReportScheduleDto ToDto(string tenantId, ReportScheduleConfig c, DateTimeOffset? lastSentAt) =>
        new(
            TenantId: tenantId,
            Enabled: c.Enabled,
            Frequency: c.Frequency,
            DayOfMonth: c.DayOfMonth,
            DayOfWeek: c.DayOfWeek,
            SendTime: c.SendTime,
            TimeZone: c.TimeZone,
            Recipients: c.Recipients,
            IncludeAiSummary: c.IncludeAiSummary,
            LastSentAt: lastSentAt,
            SmtpConfigured: emailService.IsConfigured);

    private static ReportScheduleConfig Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new ReportScheduleConfig();
        try { return JsonSerializer.Deserialize<ReportScheduleConfig>(json, JsonOpts) ?? new ReportScheduleConfig(); }
        catch { return new ReportScheduleConfig(); }
    }

    private static ReportSentLogDto ToLogDto(ReportSentLogEntity e) => new(
        e.Id, e.TenantId, e.DisplayName, e.SentAt, e.RecipientCount, e.Status, e.ErrorMessage, e.FileSizeBytes, e.ReportType);

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
