using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = "TenantReader")]
public sealed class ExpressRouteController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("expressroute/{tenantId}")]
    public async Task<IActionResult> GetExpressRoute(string tenantId, CancellationToken ct)
    {
        var response = await insightsService.GetExpressRouteDashboardAsync(tenantId, ct);
        return Ok(response);
    }
}
