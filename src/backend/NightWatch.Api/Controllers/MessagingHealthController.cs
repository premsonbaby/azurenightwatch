using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/messaging-health")]
[Authorize(Policy = "TenantReader")]
public sealed class MessagingHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetMessagingHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetMessagingHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
