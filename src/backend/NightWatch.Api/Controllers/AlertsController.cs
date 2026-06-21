using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = "TenantReader")]
public sealed class AlertsController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("alerts/{tenantId}")]
    public async Task<IActionResult> GetAlerts(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetAlertsDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
