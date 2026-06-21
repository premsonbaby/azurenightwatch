using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/nonprod-uptime-leakage")]
[Authorize(Policy = "TenantReader")]
public sealed class NonProdUptimeController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetNonProdUptime(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetNonProdUptimeDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
