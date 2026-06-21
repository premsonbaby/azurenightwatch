using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/ri-savings")]
[Authorize(Policy = "TenantReader")]
public sealed class RiSavingsController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetRiSavings(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetRiSavingsDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
