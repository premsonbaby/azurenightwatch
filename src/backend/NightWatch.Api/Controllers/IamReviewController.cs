using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/iam-review")]
[Authorize(Policy = "TenantReader")]
public sealed class IamReviewController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetIamReview(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetIamReviewDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
