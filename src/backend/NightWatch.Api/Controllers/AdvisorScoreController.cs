using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/advisor-score")]
[Authorize(Policy = "TenantReader")]
public sealed class AdvisorScoreController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetAdvisorScore(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetAdvisorScoreDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
