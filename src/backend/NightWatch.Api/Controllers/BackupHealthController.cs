using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/backup-health")]
[Authorize(Policy = "TenantReader")]
public sealed class BackupHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetBackupHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetBackupHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
