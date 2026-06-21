using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = "TenantReader")]
public sealed class VwanController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("vwan/{tenantId}")]
    public async Task<IActionResult> GetVwan(string tenantId, CancellationToken ct)
    {
        var response = await insightsService.GetVwanDashboardAsync(tenantId, ct);
        return Ok(response);
    }
}
