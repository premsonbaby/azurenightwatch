using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;
using System.Security.Claims;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/customer")]
[Authorize]
public sealed class CustomerPortalController(ITenantRegistryService tenantRegistry) : ControllerBase
{
    /// <summary>
    /// Called by the customer portal on load.
    /// Validates that the JWT tid claim belongs to a registered, active customer tenant
    /// and returns that tenant's portal configuration.
    /// </summary>
    [HttpGet("portal-config")]
    public async Task<IActionResult> GetPortalConfig(CancellationToken ct)
    {
        var tid = User.FindFirstValue("tid")
            ?? User.FindFirstValue("http://schemas.microsoft.com/identity/claims/tenantid");

        if (string.IsNullOrWhiteSpace(tid))
            return Unauthorized(new { error = "Tenant ID claim missing from token." });

        var tenant = await tenantRegistry.GetTenantAsync(tid, ct);

        if (tenant is null || !tenant.IsActive)
            return StatusCode(403, new { error = "Your organisation is not registered as a NightWatch customer." });

        return Ok(new
        {
            tenantId = tenant.TenantId,
            displayName = tenant.DisplayName,
            visibleDashboards = tenant.VisibleDashboards,
        });
    }
}
