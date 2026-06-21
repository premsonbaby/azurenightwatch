using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/capacity-planning")]
[Authorize(Policy = "TenantReader")]
public sealed class CapacityPlanningController(
    INightWatchInsightsService insightsService,
    ILogger<CapacityPlanningController> logger) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetCapacityPlanningDashboard(string tenantId, [FromQuery] string timeRange = "90d", CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Capacity planning dashboard requested. Tenant: {TenantId}, Range: {TimeRange}, User: {User}",
            tenantId,
            timeRange,
            User?.Identity?.Name ?? "unknown");

        var response = await insightsService.GetCapacityPlanningDashboardAsync(tenantId, timeRange, cancellationToken);
        return Ok(response);
    }
}