using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/cost-anomaly-forecast")]
[Authorize(Policy = "TenantReader")]
public sealed class CostAnomalyForecastController(
    INightWatchInsightsService insightsService,
    ILogger<CostAnomalyForecastController> logger) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetCostAnomalyForecastDashboard(string tenantId, [FromQuery] string timeRange = "90d", CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Cost anomaly and burn forecast dashboard requested. Tenant: {TenantId}, Range: {TimeRange}, User: {User}",
            tenantId,
            timeRange,
            User?.Identity?.Name ?? "unknown");

        var response = await insightsService.GetCostAnomalyForecastDashboardAsync(tenantId, timeRange, cancellationToken);
        return Ok(response);
    }
}
