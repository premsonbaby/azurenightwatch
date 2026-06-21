using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/cost")]
[Authorize(Policy = "TenantReader")]
public sealed class CostOptimizationController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetCostDashboard(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetCostDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
