using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/dr")]
[Authorize(Policy = "TenantReader")]
public sealed class DrComplianceController(
    INightWatchInsightsService insightsService,
    ILogger<DrComplianceController> logger) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetDrDashboard(string tenantId, CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "DR compliance dashboard requested. Tenant: {TenantId}, User: {User}",
            tenantId,
            User?.Identity?.Name ?? "unknown");

        var response = await insightsService.GetDrDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
