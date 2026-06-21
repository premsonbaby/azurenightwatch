using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/app-gateway")]
[Authorize(Policy = "TenantReader")]
public sealed class AppGatewayController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetAppGateway(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetAppGatewayDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
