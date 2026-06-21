using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using System.Security.Claims;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/alert-thresholds")]
[Authorize(Policy = "NightWatchOperator")]
public sealed class AlertThresholdsController(IAlertThresholdService thresholdService) : ControllerBase
{
    [HttpGet("{tenantId}")]
    public async Task<IActionResult> GetThresholds(string tenantId, CancellationToken ct)
    {
        var thresholds = await thresholdService.GetThresholdsAsync(tenantId, ct);
        return Ok(thresholds);
    }

    [HttpPost("{tenantId}")]
    public async Task<IActionResult> CreateThreshold(string tenantId, [FromBody] UpsertThresholdRequest request, CancellationToken ct)
    {
        if (!IsValidMetricType(request.MetricType))
            return BadRequest($"Invalid MetricType. Supported: {string.Join(", ", ValidMetricTypes)}.");
        if (!IsValidChannel(request.AlertChannel))
            return BadRequest("Invalid AlertChannel. Must be Teams or Both.");

        var threshold = await thresholdService.CreateThresholdAsync(tenantId, request, ct);
        return CreatedAtAction(nameof(GetThresholds), new { tenantId }, threshold);
    }

    [HttpPut("{tenantId}/{id:int}")]
    public async Task<IActionResult> UpdateThreshold(string tenantId, int id, [FromBody] UpsertThresholdRequest request, CancellationToken ct)
    {
        if (!IsValidMetricType(request.MetricType))
            return BadRequest("Invalid MetricType.");
        if (!IsValidChannel(request.AlertChannel))
            return BadRequest("Invalid AlertChannel.");
        try
        {
            var threshold = await thresholdService.UpdateThresholdAsync(id, request, ct);
            return Ok(threshold);
        }
        catch (InvalidOperationException) { return NotFound(); }
    }

    [HttpDelete("{tenantId}/{id:int}")]
    public async Task<IActionResult> DeleteThreshold(string tenantId, int id, CancellationToken ct)
    {
        try { await thresholdService.DeleteThresholdAsync(id, ct); return NoContent(); }
        catch (InvalidOperationException) { return NotFound(); }
    }

    [HttpGet("{tenantId}/breaches")]
    public async Task<IActionResult> GetBreaches(string tenantId, [FromQuery] int limit = 100, CancellationToken ct = default)
    {
        var breaches = await thresholdService.GetBreachesAsync(tenantId, Math.Clamp(limit, 1, 500), ct);
        return Ok(breaches);
    }

    [HttpGet("digest")]
    public async Task<IActionResult> GetAlertDigest(CancellationToken ct)
    {
        var breaches = await thresholdService.GetOpenBreachesAcrossAllTenantsAsync(ct);
        var critical = breaches.Count(b => b.Severity == "Critical");
        var high = breaches.Count(b => b.Severity == "High");
        var medium = breaches.Count(b => b.Severity == "Medium");
        var tenants = breaches.Select(b => b.TenantId).Distinct().Count();
        return Ok(new
        {
            total = breaches.Count,
            critical,
            high,
            medium,
            affectedTenants = tenants,
            breaches = breaches.OrderBy(b => b.Severity switch { "Critical" => 0, "High" => 1, _ => 2 })
                               .ThenByDescending(b => b.BreachedAt)
        });
    }

    [HttpPost("{tenantId}/breaches/{breachId:int}/acknowledge")]
    public async Task<IActionResult> AcknowledgeBreach(string tenantId, int breachId, CancellationToken ct)
    {
        var userId = User.FindFirstValue("preferred_username")
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue("name")
            ?? "Unknown";
        try
        {
            await thresholdService.AcknowledgeBreachAsync(breachId, userId, ct);
            return Ok(new { acknowledged = true, breachId, acknowledgedBy = userId });
        }
        catch (InvalidOperationException) { return NotFound(); }
    }

    private static readonly string[] ValidMetricTypes =
    [
        "MonthlyCostCeiling",
        "MonthlyCostRunRate",
        "SecurityScoreFloor",
        "AdvisorScoreFloor",
        "BackupCoverageFloor",
        "GovernanceScoreFloor",
        "ReliabilityScoreFloor",
    ];

    private static bool IsValidMetricType(string t) => ValidMetricTypes.Contains(t);
    private static bool IsValidChannel(string c) => c is "Teams" or "Both";
}
