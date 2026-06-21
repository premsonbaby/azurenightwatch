using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/azure-firewall")]
[Authorize(Policy = "TenantReader")]
public sealed class AzureFirewallController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetAzureFirewall(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetAzureFirewallDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
