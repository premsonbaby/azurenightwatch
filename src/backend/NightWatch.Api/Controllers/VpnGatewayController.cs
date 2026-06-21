using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/vpn-gateway")]
[Authorize(Policy = "TenantReader")]
public sealed class VpnGatewayController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetVpnGateway(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetVpnGatewayDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
