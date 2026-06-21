using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NightWatch.Infrastructure.Persistence;
using System.Text;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/audit-log")]
[Authorize(Policy = "NightWatchAdmin")]
public sealed class AuditLogController(NightWatchDbContext db) : ControllerBase
{
    private const int RetentionDays = 90;

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? user,
        [FromQuery] string? tenantId,
        [FromQuery] string? method,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 200);
        page = Math.Max(1, page);

        var cutoff = DateTimeOffset.UtcNow.AddDays(-RetentionDays);
        var query = db.AuditLogs
            .Where(x => x.Timestamp >= cutoff)
            .AsQueryable();

        if (from.HasValue) query = query.Where(x => x.Timestamp >= from.Value);
        if (to.HasValue)   query = query.Where(x => x.Timestamp <= to.Value);
        if (!string.IsNullOrWhiteSpace(user))
            query = query.Where(x => x.UserEmail.Contains(user) || x.UserId.Contains(user));
        if (!string.IsNullOrWhiteSpace(tenantId))
            query = query.Where(x => x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(method))
            query = query.Where(x => x.HttpMethod == method.ToUpperInvariant());

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Timestamp,
                x.UserEmail,
                x.UserId,
                x.HttpMethod,
                x.Path,
                x.TenantId,
                x.IpAddress,
                x.StatusCode,
                x.DurationMs,
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-RetentionDays);
        var query = db.AuditLogs
            .Where(x => x.Timestamp >= cutoff)
            .AsQueryable();

        if (from.HasValue) query = query.Where(x => x.Timestamp >= from.Value);
        if (to.HasValue)   query = query.Where(x => x.Timestamp <= to.Value);

        var items = await query
            .OrderByDescending(x => x.Timestamp)
            .Take(10_000)
            .Select(x => new { x.Timestamp, x.UserEmail, x.UserId, x.HttpMethod, x.Path, x.TenantId, x.IpAddress, x.StatusCode, x.DurationMs })
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Timestamp,UserEmail,UserId,Method,Path,TenantId,IpAddress,StatusCode,DurationMs");
        foreach (var r in items)
            sb.AppendLine($"{r.Timestamp:O},{CsvEscape(r.UserEmail)},{CsvEscape(r.UserId)},{r.HttpMethod},{CsvEscape(r.Path)},{CsvEscape(r.TenantId)},{CsvEscape(r.IpAddress)},{r.StatusCode},{r.DurationMs}");

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"nightwatch-audit-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    private static string CsvEscape(string? value)
    {
        if (value is null) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
