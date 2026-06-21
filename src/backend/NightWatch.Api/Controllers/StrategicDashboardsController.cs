using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/strategic")]
[Authorize(Policy = "TenantReader")]
public sealed class StrategicDashboardsController(
    INightWatchInsightsService insightsService,
    ILogger<StrategicDashboardsController> logger) : ControllerBase
{
    [HttpGet("{dashboardKey}/{tenantId}")]
    public async Task<IActionResult> GetStrategicDashboard(string dashboardKey, string tenantId, CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Strategic dashboard requested. Tenant: {TenantId}, DashboardKey: {DashboardKey}, User: {User}",
            tenantId,
            dashboardKey,
            User?.Identity?.Name ?? "unknown");

        var response = await insightsService.GetStrategicDashboardAsync(dashboardKey, tenantId, cancellationToken);
        return Ok(response);
    }

    [HttpGet("capacity-planning/{tenantId}")]
    public async Task<IActionResult> GetCapacityPlanningDashboard(string tenantId, [FromQuery] string timeRange = "90d", CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Capacity planning dashboard requested via strategic controller. Tenant: {TenantId}, Range: {TimeRange}, User: {User}",
            tenantId,
            timeRange,
            User?.Identity?.Name ?? "unknown");

        var response = await insightsService.GetCapacityPlanningDashboardAsync(tenantId, timeRange, cancellationToken);
        return Ok(response);
    }
}
