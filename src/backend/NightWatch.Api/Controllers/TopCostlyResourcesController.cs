using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/top-costly-resources")]
[Authorize(Policy = "TenantReader")]
public sealed class TopCostlyResourcesController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetTopCostlyResources(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetTopCostlyResourcesDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
