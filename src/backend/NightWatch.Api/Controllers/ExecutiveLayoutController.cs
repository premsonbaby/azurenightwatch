using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NightWatch.Infrastructure.Persistence;
using NightWatch.Infrastructure.Persistence.Entities;

namespace NightWatch.Api.Controllers;

public sealed record ExecutiveLayoutUpdateRequest(string[] WidgetKeys);

[ApiController]
[Route("api/dashboard/executive-layout")]
public sealed class ExecutiveLayoutController(NightWatchDbContext dbContext) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet("{tenantId}")]
    [Authorize(Policy = "PlatformReader")]
    public async Task<IActionResult> GetLayout(string tenantId, CancellationToken cancellationToken)
    {
        var userObjectId = ResolveUserObjectId(User);
        var record = await dbContext.ExecutiveDashboardLayouts
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.TenantId == tenantId && x.UserObjectId == userObjectId,
                cancellationToken);

        var widgetKeys = ParseWidgetKeys(record?.LayoutJson)
            .Select(NormalizeWidgetKey)
            .Where(static key => !string.IsNullOrWhiteSpace(key))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return Ok(new
        {
            tenantId,
            widgetKeys,
            updatedAtUtc = record?.UpdatedAtUtc,
        });
    }

    [HttpPut("{tenantId}")]
    [Authorize(Policy = "PlatformReader")]
    public async Task<IActionResult> UpsertLayout(string tenantId, [FromBody] ExecutiveLayoutUpdateRequest request, CancellationToken cancellationToken)
    {
        var userObjectId = ResolveUserObjectId(User);
        var normalizedKeys = (request.WidgetKeys ?? Array.Empty<string>())
            .Where(static key => !string.IsNullOrWhiteSpace(key))
            .Select(static key => NormalizeWidgetKey(key))
            .Where(static key => !string.IsNullOrWhiteSpace(key))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var now = DateTimeOffset.UtcNow;
        var existing = await dbContext.ExecutiveDashboardLayouts
            .SingleOrDefaultAsync(
                x => x.TenantId == tenantId && x.UserObjectId == userObjectId,
                cancellationToken);

        if (existing is null)
        {
            existing = new ExecutiveDashboardLayoutEntity
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserObjectId = userObjectId,
            };
            await dbContext.ExecutiveDashboardLayouts.AddAsync(existing, cancellationToken);
        }

        existing.LayoutJson = JsonSerializer.Serialize(normalizedKeys, JsonOptions);
        existing.UpdatedAtUtc = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            tenantId,
            widgetKeys = normalizedKeys,
            updatedAtUtc = now,
        });
    }

    private static string ResolveUserObjectId(ClaimsPrincipal user)
    {
        return user.FindFirstValue("oid")
            ?? user.FindFirstValue("http://schemas.microsoft.com/identity/claims/objectidentifier")
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? "dev-user";
    }

    private static string[] ParseWidgetKeys(string? layoutJson)
    {
        if (string.IsNullOrWhiteSpace(layoutJson))
        {
            return Array.Empty<string>();
        }

        try
        {
            var value = JsonSerializer.Deserialize<string[]>(layoutJson, JsonOptions);
            return value?.Where(static key => !string.IsNullOrWhiteSpace(key)).ToArray() ?? Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static string NormalizeWidgetKey(string widgetKey)
    {
        var trimmed = widgetKey.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return string.Empty;
        }

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            var path = uri.AbsolutePath.Trim('/');
            if (!string.IsNullOrWhiteSpace(path))
            {
                return path;
            }
        }

        if (trimmed.StartsWith("/", StringComparison.Ordinal))
        {
            return trimmed.Trim('/');
        }

        var pathMarker = trimmed.IndexOf("/", StringComparison.OrdinalIgnoreCase);
        if (pathMarker >= 0 && trimmed.Contains("://", StringComparison.OrdinalIgnoreCase))
        {
            var path = trimmed[(pathMarker + 1)..].Trim('/');
            if (!string.IsNullOrWhiteSpace(path))
            {
                return path;
            }
        }

        return trimmed;
    }
}
