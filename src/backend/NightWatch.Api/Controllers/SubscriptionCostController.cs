using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/subscription-cost")]
[Authorize(Policy = "TenantReader")]
public sealed class SubscriptionCostController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetSubscriptionCost(
        string tenantId,
        [FromQuery] int months = 3,
        CancellationToken cancellationToken = default)
    {
        var dashboard = await insightsService.GetSubscriptionCostDashboardAsync(tenantId, months, cancellationToken);
        return Ok(dashboard);
    }
}
