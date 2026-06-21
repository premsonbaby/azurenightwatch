using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Memory;
using NightWatch.Application.Abstractions;
using System.Security.Claims;

namespace NightWatch.Api.Auth;

public sealed class NightWatchDataReadRequirement : IAuthorizationRequirement { }

/// <summary>
/// Succeeds when the caller is:
///   a) An MSP user with any NightWatch app role (Admin / Operator / Reader), OR
///   b) A customer portal user whose AAD tenant (tid claim) is a registered active customer.
/// Customer users are cached for 5 minutes to avoid a DB hit on every request.
/// </summary>
public sealed class NightWatchDataReadHandler(
    ITenantRegistryService tenantRegistry,
    IMemoryCache cache) : AuthorizationHandler<NightWatchDataReadRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        NightWatchDataReadRequirement requirement)
    {
        // MSP users: any NightWatch role in the token
        if (HasAnyNightWatchRole(context.User))
        {
            context.Succeed(requirement);
            return;
        }

        // Customer portal users: tid maps to a registered, active customer tenant
        var tid = context.User.FindFirstValue("tid")
            ?? context.User.FindFirstValue("http://schemas.microsoft.com/identity/claims/tenantid");

        if (string.IsNullOrWhiteSpace(tid)) return;

        var cacheKey = $"nw:customer-read::{tid}";
        if (!cache.TryGetValue(cacheKey, out bool isRegistered))
        {
            var tenant = await tenantRegistry.GetTenantAsync(tid);
            isRegistered = tenant?.IsActive == true;
            cache.Set(cacheKey, isRegistered, TimeSpan.FromMinutes(5));
        }

        if (isRegistered)
            context.Succeed(requirement);
    }

    private static bool HasAnyNightWatchRole(ClaimsPrincipal user) =>
        user.Claims.Any(c =>
            (c.Type == "roles" || c.Type == ClaimTypes.Role) &&
            c.Value is "NightWatch.Admin" or "NightWatch.Operator" or "NightWatch.Reader");
}
