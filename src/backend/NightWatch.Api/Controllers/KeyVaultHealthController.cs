using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/key-vault-health")]
[Authorize(Policy = "TenantReader")]
public sealed class KeyVaultHealthController(INightWatchInsightsService insightsService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetKeyVaultHealth(string tenantId, CancellationToken cancellationToken)
    {
        var response = await insightsService.GetKeyVaultHealthDashboardAsync(tenantId, cancellationToken);
        return Ok(response);
    }
}
