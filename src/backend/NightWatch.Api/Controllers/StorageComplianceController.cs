using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/storage-compliance")]
[Authorize(Policy = "TenantReader")]
public sealed class StorageComplianceController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetStorageCompliance(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetStorageComplianceDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
