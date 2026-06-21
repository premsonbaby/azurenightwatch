using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/identity-attack-surface")]
public sealed class IdentityAttackSurfaceController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetIdentityAttackSurface(string tenantId, CancellationToken cancellationToken)
    {
        var result = await insightsService.GetIdentityAttackSurfaceDashboardAsync(tenantId, cancellationToken);
        return Ok(result);
    }
}
