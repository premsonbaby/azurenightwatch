using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/app-functions-health")]
[Authorize(Policy = "TenantReader")]
public sealed class AppFunctionsHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetAppFunctionsHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetAppFunctionsHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
