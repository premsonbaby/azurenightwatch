using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/wastage-tracker")]
[Authorize(Policy = "TenantReader")]
public sealed class WastageTrackerController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetWastageTracker(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetWastageTrackerDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
