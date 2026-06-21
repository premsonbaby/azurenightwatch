using Microsoft.AspNetCore.Authorization;

namespace NightWatch.Api.Auth;

public sealed class TenantAccessRequirement(string routeParameterName = "tenantId", string tenantsClaimType = "nw_tenants") : IAuthorizationRequirement
{
    public string RouteParameterName { get; } = routeParameterName;
    public string TenantsClaimType { get; } = tenantsClaimType;
}
