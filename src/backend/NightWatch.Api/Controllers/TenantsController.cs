using Azure.Core;
using Azure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Options;
using System.Net.Http.Headers;
using System.Text.Json;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize(Policy = "PlatformReader")]
public sealed class TenantsController(
    ITenantRegistryService tenantRegistry,
    INightWatchInsightsService insightsService,
    IHttpClientFactory httpFactory,
    IOptions<MultiTenantOptions> multiTenantOpts) : ControllerBase
{
    private static readonly TokenRequestContext ManagementScope = new(["https://management.azure.com/.default"]);

    // ── Customer tenant registry ──────────────────────────────────────────────

    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants(CancellationToken ct)
    {
        var tenants = await tenantRegistry.GetAllTenantsAsync(ct);
        return Ok(tenants);
    }

    [HttpPost("tenants")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> AddTenant([FromBody] AddTenantRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.TenantId) || string.IsNullOrWhiteSpace(request.DisplayName))
            return BadRequest("TenantId and DisplayName are required.");

        try
        {
            var tenant = await tenantRegistry.AddTenantAsync(request, ct);
            return CreatedAtAction(nameof(GetTenant), new { tenantId = tenant.TenantId }, tenant);
        }
        catch (Exception ex) when (ex.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase)
                                  || ex.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict($"Tenant {request.TenantId} is already registered.");
        }
    }

    [HttpGet("tenants/{tenantId}")]
    public async Task<IActionResult> GetTenant(string tenantId, CancellationToken ct)
    {
        var tenant = await tenantRegistry.GetTenantAsync(tenantId, ct);
        return tenant is null ? NotFound() : Ok(tenant);
    }

    [HttpDelete("tenants/{tenantId}")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> DeleteTenant(string tenantId, CancellationToken ct)
    {
        try
        {
            await tenantRegistry.DeleteTenantAsync(tenantId, ct);
            return NoContent();
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
    }

    [HttpPut("tenants/{tenantId}/settings")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> UpdateTenantSettings(string tenantId, [FromBody] UpdateTenantSettingsRequest request, CancellationToken ct)
    {
        try
        {
            var tenant = await tenantRegistry.UpdateTenantSettingsAsync(tenantId, request, ct);
            return Ok(tenant);
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
    }

    // ── Verify — test credential can list subscriptions in customer tenant ───

    [HttpPost("tenants/{tenantId}/verify")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> VerifyTenant(string tenantId, CancellationToken ct)
    {
        var opts = multiTenantOpts.Value;
        if (string.IsNullOrWhiteSpace(opts.ClientId) || string.IsNullOrWhiteSpace(opts.ClientSecret))
            return BadRequest("Multi-tenant app credentials are not configured.");

        try
        {
            var credential = new ClientSecretCredential(tenantId, opts.ClientId, opts.ClientSecret);
            var token = await credential.GetTokenAsync(ManagementScope, ct);

            var client = httpFactory.CreateClient("SubscriptionDiscovery");
            using var req = new HttpRequestMessage(HttpMethod.Get, "/subscriptions?api-version=2022-12-01");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
            using var resp = await client.SendAsync(req, ct);

            if (!resp.IsSuccessStatusCode)
                return BadRequest($"Credential check failed: HTTP {(int)resp.StatusCode}.");

            await tenantRegistry.MarkVerifiedAsync(tenantId, ct);
            return Ok(new { verified = true });
        }
        catch (Exception ex)
        {
            var msg = ex.Message;
            var inner = ex.InnerException;
            while (inner is not null)
            {
                msg += $" → {inner.Message}";
                inner = inner.InnerException;
            }
            return BadRequest($"Verification failed: {msg}");
        }
    }

    // ── Log Analytics workspaces in customer tenant ──────────────────────────

    [HttpGet("tenants/{tenantId}/workspaces")]
    public async Task<IActionResult> GetWorkspaces(string tenantId, CancellationToken ct)
    {
        var opts = multiTenantOpts.Value;
        if (string.IsNullOrWhiteSpace(opts.ClientId) || string.IsNullOrWhiteSpace(opts.ClientSecret))
            return BadRequest("Multi-tenant app credentials are not configured.");

        try
        {
            var credential = new ClientSecretCredential(tenantId, opts.ClientId, opts.ClientSecret);
            var token = await credential.GetTokenAsync(ManagementScope, ct);

            var client = httpFactory.CreateClient("SubscriptionDiscovery");
            using var subReq = new HttpRequestMessage(HttpMethod.Get, "/subscriptions?api-version=2022-12-01");
            subReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
            using var subResp = await client.SendAsync(subReq, ct);
            subResp.EnsureSuccessStatusCode();

            await using var subStream = await subResp.Content.ReadAsStreamAsync(ct);
            using var subDoc = await JsonDocument.ParseAsync(subStream, cancellationToken: ct);

            var workspaces = new List<LogAnalyticsWorkspaceDto>();

            if (subDoc.RootElement.TryGetProperty("value", out var subs))
            {
                foreach (var sub in subs.EnumerateArray())
                {
                    var subId = sub.TryGetProperty("subscriptionId", out var sid) ? sid.GetString() : null;
                    if (string.IsNullOrWhiteSpace(subId)) continue;

                    var url = $"/subscriptions/{subId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2023-09-01";
                    using var wsReq = new HttpRequestMessage(HttpMethod.Get, url);
                    wsReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
                    using var wsResp = await client.SendAsync(wsReq, ct);
                    if (!wsResp.IsSuccessStatusCode) continue;

                    await using var wsStream = await wsResp.Content.ReadAsStreamAsync(ct);
                    using var wsDoc = await JsonDocument.ParseAsync(wsStream, cancellationToken: ct);

                    if (wsDoc.RootElement.TryGetProperty("value", out var wsArr))
                    {
                        foreach (var ws in wsArr.EnumerateArray())
                        {
                            var wsId = ws.TryGetProperty("properties", out var props)
                                && props.TryGetProperty("customerId", out var cid)
                                ? cid.GetString() : null;
                            var wsName = ws.TryGetProperty("name", out var wn) ? wn.GetString() : null;
                            var rg = ws.TryGetProperty("id", out var wsResId)
                                ? ExtractResourceGroup(wsResId.GetString() ?? "")
                                : null;

                            if (wsId is not null && wsName is not null)
                                workspaces.Add(new LogAnalyticsWorkspaceDto(wsId, wsName, rg ?? "", subId));
                        }
                    }
                }
            }

            return Ok(workspaces);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to list workspaces: {ex.Message}");
        }
    }

    // ── Admin consent URL ────────────────────────────────────────────────────

    [HttpGet("admin/consent-url")]
    public IActionResult GetConsentUrl([FromQuery] string tenantId)
    {
        var opts = multiTenantOpts.Value;
        if (string.IsNullOrWhiteSpace(opts.ClientId))
            return BadRequest("MultiTenant:ClientId is not configured.");

        var redirectUri = Uri.EscapeDataString("https://eun-p-nightwatch-web.azurewebsites.net/tenants/consent-callback");
        var url = $"https://login.microsoftonline.com/{tenantId}/adminconsent?client_id={opts.ClientId}&redirect_uri={redirectUri}";
        return Ok(new { consentUrl = url });
    }

    // ── Legacy: Azure subscription overview (used by existing UI) ────────────

    [HttpGet("tenants/azure-overview")]
    public async Task<IActionResult> GetAzureTenantOverview(CancellationToken ct)
    {
        var response = await insightsService.GetTenantOverviewAsync(ct);
        return Ok(response);
    }

    // ── Consent check — verify service principal exists in customer tenant ───

    [HttpPost("tenants/{tenantId}/check-consent")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> CheckConsent(string tenantId, CancellationToken ct)
    {
        var opts = multiTenantOpts.Value;
        if (string.IsNullOrWhiteSpace(opts.ClientId) || string.IsNullOrWhiteSpace(opts.ClientSecret))
            return BadRequest("Multi-tenant app credentials are not configured.");

        try
        {
            var credential = new ClientSecretCredential(tenantId, opts.ClientId, opts.ClientSecret);
            var graphToken = await credential.GetTokenAsync(
                new TokenRequestContext(["https://graph.microsoft.com/.default"]), ct);

            var client = httpFactory.CreateClient();
            var filter = Uri.EscapeDataString($"appId eq '{opts.ClientId}'");
            using var req = new HttpRequestMessage(HttpMethod.Get,
                $"https://graph.microsoft.com/v1.0/servicePrincipals?$filter={filter}&$select=id,appId,displayName");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", graphToken.Token);
            using var resp = await client.SendAsync(req, ct);

            if (!resp.IsSuccessStatusCode)
                return Ok(new { consentGranted = false, message = $"Graph API returned HTTP {(int)resp.StatusCode}. Admin consent may not yet be granted." });

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

            var hasValue = doc.RootElement.TryGetProperty("value", out var value)
                && value.ValueKind == JsonValueKind.Array
                && value.GetArrayLength() > 0;

            if (!hasValue)
                return Ok(new { consentGranted = false, message = "Service principal not found in this tenant. The admin consent link has not been approved yet." });

            var spId = value[0].TryGetProperty("id", out var id) ? id.GetString() : null;
            return Ok(new { consentGranted = true, servicePrincipalId = spId, message = "Admin consent confirmed — NightWatch service principal exists in this tenant." });
        }
        catch (Exception ex)
        {
            return Ok(new { consentGranted = false, message = $"Consent check failed: {ex.Message}" });
        }
    }

    // ── Data test — verify Resource Graph returns results from customer tenant ─

    [HttpPost("tenants/{tenantId}/test-data")]
    [Authorize(Policy = "NightWatchOperator")]
    public async Task<IActionResult> TestData(string tenantId, CancellationToken ct)
    {
        var opts = multiTenantOpts.Value;
        if (string.IsNullOrWhiteSpace(opts.ClientId) || string.IsNullOrWhiteSpace(opts.ClientSecret))
            return BadRequest("Multi-tenant app credentials are not configured.");

        try
        {
            var credential = new ClientSecretCredential(tenantId, opts.ClientId, opts.ClientSecret);
            var token = await credential.GetTokenAsync(ManagementScope, ct);

            var mgmtClient = httpFactory.CreateClient("SubscriptionDiscovery");
            using var subReq = new HttpRequestMessage(HttpMethod.Get, "/subscriptions?api-version=2022-12-01");
            subReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
            using var subResp = await mgmtClient.SendAsync(subReq, ct);

            if (!subResp.IsSuccessStatusCode)
                return Ok(new { success = false, subscriptionCount = 0, resourceCount = 0,
                    message = $"Cannot list subscriptions: HTTP {(int)subResp.StatusCode}. Check that Reader role is assigned on subscriptions." });

            await using var subStream = await subResp.Content.ReadAsStreamAsync(ct);
            using var subDoc = await JsonDocument.ParseAsync(subStream, cancellationToken: ct);

            var subIds = new List<string>();
            if (subDoc.RootElement.TryGetProperty("value", out var subs))
                foreach (var sub in subs.EnumerateArray())
                    if (sub.TryGetProperty("subscriptionId", out var sid) && sid.GetString() is string s)
                        subIds.Add(s);

            if (subIds.Count == 0)
                return Ok(new { success = false, subscriptionCount = 0, resourceCount = 0,
                    message = "No subscriptions visible. Assign Reader role to the NightWatch service principal at the Root Management Group or subscription level." });

            using var graphReq = new HttpRequestMessage(HttpMethod.Post,
                "/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01");
            graphReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
            graphReq.Content = JsonContent.Create(new { query = "Resources | take 5", subscriptions = subIds });
            using var graphResp = await mgmtClient.SendAsync(graphReq, ct);

            var resourceCount = 0;
            if (graphResp.IsSuccessStatusCode)
            {
                await using var graphStream = await graphResp.Content.ReadAsStreamAsync(ct);
                using var graphDoc = await JsonDocument.ParseAsync(graphStream, cancellationToken: ct);
                if (graphDoc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                    resourceCount = data.GetArrayLength();
            }

            return Ok(new
            {
                success = true,
                subscriptionCount = subIds.Count,
                resourceCount,
                message = $"Data access confirmed — {subIds.Count} subscription(s) visible, {resourceCount} resource(s) returned from test query.",
            });
        }
        catch (Exception ex)
        {
            return Ok(new { success = false, subscriptionCount = 0, resourceCount = 0, message = $"Data test failed: {ex.Message}" });
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private static string ExtractResourceGroup(string resourceId)
    {
        var parts = resourceId.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (var i = 0; i < parts.Length - 1; i++)
            if (string.Equals(parts[i], "resourceGroups", StringComparison.OrdinalIgnoreCase))
                return parts[i + 1];
        return "";
    }
}
