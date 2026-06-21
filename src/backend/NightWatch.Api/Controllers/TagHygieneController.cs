using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/tag-hygiene-compliance")]
[Authorize(Policy = "TenantReader")]
public sealed class TagHygieneController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetTagHygiene(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetTagHygieneDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
