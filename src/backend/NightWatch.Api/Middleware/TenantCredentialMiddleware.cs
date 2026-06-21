using Azure.Identity;
using Microsoft.Extensions.Options;
using NightWatch.Infrastructure.Options;
using NightWatch.Infrastructure.Services.Azure;

namespace NightWatch.Api.Middleware;

public sealed class TenantCredentialMiddleware(RequestDelegate next, IOptions<MultiTenantOptions> opts)
{
    private readonly MultiTenantOptions _opts = opts.Value;

    public async Task InvokeAsync(HttpContext context)
    {
        var routeTenantId = context.Request.RouteValues["tenantId"]?.ToString()
            ?? context.Request.Headers["X-Tenant-Id"].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(routeTenantId)
            && Guid.TryParse(routeTenantId, out _)
            && !string.Equals(routeTenantId, _opts.HomeTenantId, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(_opts.ClientId)
            && !string.IsNullOrWhiteSpace(_opts.ClientSecret))
        {
            var credential = new ClientSecretCredential(routeTenantId, _opts.ClientId, _opts.ClientSecret);
            TenantCredentialContext.Set(credential, routeTenantId);
            try
            {
                await next(context);
            }
            finally
            {
                TenantCredentialContext.Clear();
            }
        }
        else
        {
            await next(context);
        }
    }
}
