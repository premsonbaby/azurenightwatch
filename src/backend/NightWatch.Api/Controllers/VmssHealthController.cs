using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/vmss-health")]
[Authorize(Policy = "TenantReader")]
public sealed class VmssHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetVmssHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetVmssHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
