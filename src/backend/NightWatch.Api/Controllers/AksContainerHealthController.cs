using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/aks-container-health")]
[Authorize(Policy = "TenantReader")]
public sealed class AksContainerHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetAksContainerHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetAksContainerHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
