using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace NightWatch.Api.Auth;

/// <summary>
/// Development-only authentication handler that auto-authenticates every request
/// with all NightWatch roles and a configurable tenant list.
/// Never registered outside of the Development environment.
/// </summary>
public sealed class DevBypassAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "DevBypass";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new List<Claim>
        {
            new("sub", "dev-user"),
            new("name", "Local Developer"),
            new("roles", "NightWatch.Admin"),
            new("roles", "NightWatch.Operator"),
            new("roles", "NightWatch.Reader"),
            new(ClaimTypes.Role, "NightWatch.Admin"),
            new(ClaimTypes.Role, "NightWatch.Operator"),
            new(ClaimTypes.Role, "NightWatch.Reader"),
            // Grant access to all tenants by listing known tenant IDs
            new("nw_tenants", "tenant-a"),
            new("nw_tenants", "tenant-b"),
            new("nw_tenants", "tenant-c"),
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
