using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/executive")]
[Authorize(Policy = "TenantReader")]
public sealed class ExecutiveDashboardController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetExecutiveDashboard(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetExecutiveDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }

    [HttpGet("network-topology/{tenantId}")]
    public async Task<IActionResult> GetNetworkTopologyDashboard(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetNetworkTopologyDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
