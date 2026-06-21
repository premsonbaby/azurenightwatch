using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;

namespace NightWatch.Api.Auth;

public sealed class TenantAccessHandler : AuthorizationHandler<TenantAccessRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, TenantAccessRequirement requirement)
    {
        var httpContext = context.Resource switch
        {
            HttpContext direct => direct,
            AuthorizationFilterContext filter => filter.HttpContext,
            _ => null
        };

        if (httpContext is null)
        {
            return Task.CompletedTask;
        }

        // All authenticated users on this MSP-internal platform have access to all tenants.
        // Authentication (MSAL) already ensures only MSP operators can obtain tokens.
        if (context.User.Identity?.IsAuthenticated == true)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
