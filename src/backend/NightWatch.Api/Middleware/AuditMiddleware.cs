using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;
using System.Diagnostics;
using System.Security.Claims;

namespace NightWatch.Api.Middleware;

public sealed class AuditMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> SkippedPrefixes = ["/health", "/swagger", "/favicon"];

    public async Task InvokeAsync(HttpContext context, IServiceScopeFactory scopeFactory)
    {
        var path = context.Request.Path.Value ?? "";

        // Skip non-API and non-authenticated paths
        if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase)
            || SkippedPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            await next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        await next(context);
        sw.Stop();

        // Only persist for authenticated requests
        if (context.User.Identity?.IsAuthenticated != true) return;

        var userId = context.User.FindFirstValue("oid")
            ?? context.User.FindFirstValue("http://schemas.microsoft.com/identity/claims/objectidentifier")
            ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? "";

        if (string.IsNullOrEmpty(userId)) return;

        var userEmail = context.User.FindFirstValue("preferred_username")
            ?? context.User.FindFirstValue("upn")
            ?? context.User.FindFirstValue(ClaimTypes.Email)
            ?? "";

        var tenantId = context.Request.Headers["X-Tenant-Id"].FirstOrDefault();
        var ip = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
            ?? context.Connection.RemoteIpAddress?.ToString();

        var entry = new AuditLogEntity
        {
            UserId = userId,
            UserEmail = userEmail,
            HttpMethod = context.Request.Method,
            Path = path.Length > 1024 ? path[..1024] : path,
            TenantId = tenantId,
            IpAddress = ip?.Length > 64 ? ip[..64] : ip,
            StatusCode = context.Response.StatusCode,
            DurationMs = (int)sw.ElapsedMilliseconds,
            Timestamp = DateTimeOffset.UtcNow,
        };

        // Fire-and-forget via a new scope so we don't block the response
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<NightWatchDbContext>();
                db.AuditLogs.Add(entry);
                await db.SaveChangesAsync();
            }
            catch { /* best-effort — never fail the request for audit logging */ }
        });
    }
}
