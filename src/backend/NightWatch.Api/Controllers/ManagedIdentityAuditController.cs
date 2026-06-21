using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/managed-identity-audit")]
[Authorize(Policy = "TenantReader")]
public sealed class ManagedIdentityAuditController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetManagedIdentityAudit(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetManagedIdentityAuditDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
