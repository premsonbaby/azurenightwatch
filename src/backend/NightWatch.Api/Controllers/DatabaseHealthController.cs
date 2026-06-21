using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/database-health")]
[Authorize(Policy = "TenantReader")]
public sealed class DatabaseHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetDatabaseHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetDatabaseHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
