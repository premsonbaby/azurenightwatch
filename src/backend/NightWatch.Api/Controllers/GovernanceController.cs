using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/governance")]
[Authorize(Policy = "TenantReader")]
public sealed class GovernanceController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetGovernanceDashboard(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetGovernanceDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
