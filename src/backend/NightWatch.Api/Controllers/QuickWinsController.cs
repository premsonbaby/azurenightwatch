using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/quick-wins")]
[Authorize(Policy = "TenantReader")]
public sealed class QuickWinsController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetQuickWins(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetQuickWinsDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
