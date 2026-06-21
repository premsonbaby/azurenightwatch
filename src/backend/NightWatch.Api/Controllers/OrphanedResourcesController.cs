using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/orphaned-resources")]
[Authorize(Policy = "TenantReader")]
public sealed class OrphanedResourcesController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetOrphanedResources(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetOrphanedResourcesDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
