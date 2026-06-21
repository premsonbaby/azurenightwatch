using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api")]
public class ConfigController(IConfiguration configuration, IWebHostEnvironment env) : ControllerBase
{
    /// <summary>
    /// Returns public, non-sensitive configuration the SPA needs to bootstrap MSAL.
    /// AllowAnonymous — this endpoint must be reachable before the user is authenticated.
    /// </summary>
    [HttpGet("config")]
    [AllowAnonymous]
    public IActionResult GetPublicConfig()
    {
        // In Development the DevBypassAuthHandler handles auth, so MSAL is not needed.
        var msalEnabled = !env.IsDevelopment();
        var audience = configuration["AzureAd:Audience"];
        var clientId = configuration["AzureAd:ClientId"];
        var apiScope = BuildApiScope(audience, clientId);

        return Ok(new
        {
            tenantId = configuration["AzureAd:TenantId"],
            clientId,
            apiScope,
            msalEnabled,
        });
    }

    /// <summary>
    /// Verifies the caller is an authenticated MSP operator from the home tenant.
    /// Returns 200 only when the token's tid claim matches MultiTenant:HomeTenantId.
    /// The backend uses "organizations" authority so any AAD user can obtain a valid token;
    /// this endpoint is the gate that restricts access to MSP staff only.
    /// </summary>
    [HttpGet("auth/check")]
    [Authorize]
    public IActionResult CheckMspAccess()
    {
        var tid = User.FindFirst("tid")?.Value
               ?? User.FindFirst("http://schemas.microsoft.com/identity/claims/tenantid")?.Value;

        var homeTenantId = configuration["MultiTenant:HomeTenantId"]?.Trim();

        if (!string.IsNullOrWhiteSpace(homeTenantId) &&
            !string.Equals(tid, homeTenantId, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        return Ok();
    }

    private static string? BuildApiScope(string? audience, string? clientId)
    {
        if (!string.IsNullOrWhiteSpace(audience))
        {
            var trimmedAudience = audience.Trim().TrimEnd('/');
            if (trimmedAudience.StartsWith("api://", StringComparison.OrdinalIgnoreCase) ||
                trimmedAudience.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return $"{trimmedAudience}/user_impersonation";
            }

            return $"api://{trimmedAudience}/user_impersonation";
        }

        return !string.IsNullOrWhiteSpace(clientId)
            ? $"api://{clientId}/user_impersonation"
            : null;
    }
}
