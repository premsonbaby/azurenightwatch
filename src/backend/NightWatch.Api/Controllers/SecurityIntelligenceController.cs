using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/security")]
[Authorize(Policy = "TenantReader")]
public sealed class SecurityIntelligenceController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetSecurityDashboard(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetSecurityDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
