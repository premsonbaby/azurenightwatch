using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/health-snapshots")]
[Authorize(Policy = "TenantReader")]
public sealed class HealthSnapshotsController(IHealthSnapshotService snapshotService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetHistory(
        string tenantId,
        [FromQuery] int months = 12,
        CancellationToken cancellationToken = default)
    {
        var history = await snapshotService.GetHistoryAsync(tenantId, months, cancellationToken);
        return Ok(history);
    }

    [HttpPost("{tenantId}/capture")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> CaptureNow(string tenantId, CancellationToken cancellationToken)
    {
        await snapshotService.CaptureSnapshotAsync(tenantId, cancellationToken);
        return Ok(new { captured = true, tenantId, month = DateTimeOffset.UtcNow.ToString("yyyy-MM") });
    }
}
