using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/network-perimeter")]
[Authorize(Policy = "TenantReader")]
public sealed class NetworkPerimeterController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetNetworkPerimeter(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetNetworkPerimeterDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
