using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/service-health")]
[Authorize(Policy = "TenantReader")]
public sealed class ServiceHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetServiceHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetServiceHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
