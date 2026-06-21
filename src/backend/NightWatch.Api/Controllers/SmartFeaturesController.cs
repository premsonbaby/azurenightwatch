using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/smart")]
[Authorize(Policy = "TenantReader")]
public sealed class SmartFeaturesController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetSmartFeatures(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetSmartFeaturesAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
