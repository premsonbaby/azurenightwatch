using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/resources")]
[Authorize(Policy = "TenantReader")]
public sealed class ResourceDeepDiveController(
    INightWatchInsightsService insightsService,
    ILogger<ResourceDeepDiveController> logger) : ControllerBase
{
    [HttpGet("deep-dive/{tenantId}")]
    public async Task<IActionResult> GetDeepDive(string tenantId, [FromQuery] string resourceId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(resourceId))
        {
            return BadRequest(new { message = "resourceId query parameter is required." });
        }

        logger.LogInformation(
            "Resource deep-dive requested. Tenant: {TenantId}, ResourceId: {ResourceId}, User: {User}",
            tenantId,
            resourceId,
            User?.Identity?.Name ?? "unknown");

        var response = await insightsService.GetResourceDeepDiveAsync(resourceId, tenantId, cancellationToken);
        return Ok(response);
    }
}
