using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/policy-radar")]
[Authorize(Policy = "TenantReader")]
public sealed class AzPolicyLensController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetAzPolicyLens(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetAzPolicyLensDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
