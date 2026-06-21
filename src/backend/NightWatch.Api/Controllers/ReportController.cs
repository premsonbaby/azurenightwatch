using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;
using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Policy = "PlatformReader")]
public sealed class ReportController(
    IReportService reportService,
    ITenantRegistryService tenantRegistry,
    IHttpClientFactory httpClientFactory,
    TokenCredential credential,
    IOperationsScopeService operationsScope,
    ILogger<ReportController> logger) : ControllerBase
{
    [HttpGet("{tenantId}/html")]
    public async Task<IActionResult> GetHtmlReport(
        string tenantId,
        [FromQuery] bool aiEnabled = false,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("HTML report requested for tenant {TenantId}, AI={AiEnabled}", tenantId, aiEnabled);

        var displayName = await ResolveTenantDisplayNameAsync(tenantId, cancellationToken);
        var html = await reportService.GenerateHtmlReportAsync(tenantId, new ReportOptions(aiEnabled, displayName), cancellationToken);
        var bytes = Encoding.UTF8.GetBytes(html);
        var safeName = (displayName ?? "nightwatch").Replace(" ", "-");
        var fileName = $"nightwatch-report-{safeName}-{DateTime.UtcNow:yyyy-MM-dd}.html";
        return File(bytes, "text/html; charset=utf-8", fileName);
    }

    [HttpGet("{tenantId}/pdf")]
    public async Task<IActionResult> GetPdfReport(
        string tenantId,
        [FromQuery] bool aiEnabled = false,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("PDF report requested for tenant {TenantId}, AI={AiEnabled}", tenantId, aiEnabled);

        var displayName = await ResolveTenantDisplayNameAsync(tenantId, cancellationToken);
        var pdf = await reportService.GeneratePdfReportAsync(tenantId, new ReportOptions(aiEnabled, displayName), cancellationToken);
        var safeName = (displayName ?? "nightwatch").Replace(" ", "-");
        var fileName = $"nightwatch-report-{safeName}-{DateTime.UtcNow:yyyy-MM-dd}.pdf";
        return File(pdf, "application/pdf", fileName);
    }

    private async Task<string?> ResolveTenantDisplayNameAsync(string tenantId, CancellationToken ct)
    {
        if (tenantId != "global")
        {
            var tenant = await tenantRegistry.GetTenantAsync(tenantId, ct);
            if (tenant is not null) return tenant.DisplayName;
        }

        // For home tenant: prefer the configured customer/environment name from Teams settings
        var customerName = operationsScope.GetTeamsSettings().CustomerName;
        if (!string.IsNullOrWhiteSpace(customerName)) return customerName;

        return await ResolveEnvironmentNameAsync(ct);
    }

    private async Task<string?> ResolveEnvironmentNameAsync(CancellationToken cancellationToken)
    {
        try
        {
            var tokenCtx = new TokenRequestContext(["https://management.azure.com/.default"]);
            var token = await credential.GetTokenAsync(tokenCtx, cancellationToken);

            var client = httpClientFactory.CreateClient("SubscriptionDiscovery");
            using var req = new HttpRequestMessage(HttpMethod.Get, "/tenants?api-version=2022-12-01");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);

            using var resp = await client.SendAsync(req, cancellationToken);
            if (!resp.IsSuccessStatusCode) return null;

            await using var stream = await resp.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (!doc.RootElement.TryGetProperty("value", out var arr)) return null;

            var tenants = arr.EnumerateArray().ToList();

            // Extract best display name from a single tenant element
            static string? BestName(JsonElement t)
            {
                if (t.TryGetProperty("displayName", out var dn) && !string.IsNullOrWhiteSpace(dn.GetString()))
                    return dn.GetString();
                if (t.TryGetProperty("defaultDomain", out var dd) && !string.IsNullOrWhiteSpace(dd.GetString()))
                    return dd.GetString();
                // Fall back to first entry in the domains array
                if (t.TryGetProperty("domains", out var domains) && domains.ValueKind == JsonValueKind.Array)
                    return domains.EnumerateArray()
                        .Select(d => d.GetString())
                        .FirstOrDefault(d => !string.IsNullOrWhiteSpace(d));
                return null;
            }

            string? Pick(Func<JsonElement, bool> predicate) =>
                tenants.Where(predicate).Select(BestName).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n));

            return Pick(t => t.TryGetProperty("tenantCategory", out var cat) && cat.GetString() == "Home")
                ?? Pick(_ => true);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to resolve Azure tenant display name.");
            return null;
        }
    }
}
