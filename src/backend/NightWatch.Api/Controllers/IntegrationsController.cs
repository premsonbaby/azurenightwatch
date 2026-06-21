using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/integrations")]
[Authorize(Policy = "PlatformOperator")]
public sealed class IntegrationsController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("catalog")]
    public async Task<IActionResult> GetIntegrationCatalog(CancellationToken cancellationToken)
    {
        var response = await insightsService.GetIntegrationCatalogAsync(cancellationToken);
        return Ok(response);
    }
}
