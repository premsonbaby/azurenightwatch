using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Application.Abstractions;
using NightWatch.Infrastructure.Abstractions;
using System.Text.Json;

namespace NightWatch.Api.Controllers;

[ApiController]
[Route("api/dashboard/export")]
[Authorize(Policy = "TenantReader")]
public sealed class ExportController(
    INightWatchInsightsService insightsService,
    IOperationsScopeService operationsScopeService,
    IAiSummaryService aiSummaryService,
    ILogger<ExportController> logger) : ControllerBase
{
    private static readonly string[] DefaultVisibleWidgetKeys =
    [
        "azureHealth",
        "security",
        "performance",
        "cost",
        "governance",
        "reliability",
        "dailyCostAnalysis",
        "ri-savings",
    ];

    private static readonly string[] StrategicDashboardKeys =
    [
        "executive-cost-roi",
        "cost-allocation",
        "wastage-tracker",
        "ri-savings",
        "spend-anomaly",
        "compliance-scorecard",
        "iam-review",
        "network-perimeter",
        "backup-health",
        "threat-map",
        "compute-scaling",
        "hubspoke-expressroute",
        "storage-iops",
        "aks-operations",
        "sql-managed-instance",
        "cosmos-performance",
        "data-pipelines",
        "app-functions-health",
        "apim-operations",
        "microservices-map",
    ];

    public sealed record ExecutivePdfSummaryRequest(IReadOnlyCollection<string>? VisibleWidgetKeys);

    [HttpPost("executive/{tenantId}/pdf-summary")]
    public async Task<IActionResult> GenerateExecutivePdfSummary(
        string tenantId,
        [FromBody] ExecutivePdfSummaryRequest? request,
        CancellationToken cancellationToken)
    {
        var executiveTask = insightsService.GetExecutiveDashboardAsync(tenantId, cancellationToken);
        var securityTask = insightsService.GetSecurityDashboardAsync(tenantId, cancellationToken);
        var performanceTask = insightsService.GetPerformanceDashboardAsync(tenantId, cancellationToken);
        var costTask = insightsService.GetCostDashboardAsync(tenantId, cancellationToken);
        var governanceTask = insightsService.GetGovernanceDashboardAsync(tenantId, cancellationToken);
        var smartTask = insightsService.GetSmartFeaturesAsync(tenantId, cancellationToken);
        var topologyTask = insightsService.GetNetworkTopologyDashboardAsync(tenantId, cancellationToken);

        await Task.WhenAll(executiveTask, securityTask, performanceTask, costTask, governanceTask, smartTask, topologyTask);

        var visibleWidgetKeys = (request?.VisibleWidgetKeys?.Count ?? 0) > 0
            ? request!.VisibleWidgetKeys!
                .Where(static key => !string.IsNullOrWhiteSpace(key))
                .Select(static key => key.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray()
            : DefaultVisibleWidgetKeys;

        var visibleDashboardSnapshots = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["azureHealth"] = new
            {
                executiveTask.Result.AzureHealthScore,
                executiveTask.Result.SecurityPostureScore,
                executiveTask.Result.PerformanceScore,
                executiveTask.Result.CostEfficiencyScore,
                executiveTask.Result.ReliabilityScore,
                executiveTask.Result.GovernanceComplianceScore,
            },
            ["security"] = securityTask.Result,
            ["performance"] = performanceTask.Result,
            ["cost"] = costTask.Result,
            ["governance"] = governanceTask.Result,
            ["reliability"] = new
            {
                executiveTask.Result.ReliabilityScore,
                performanceTask.Result.SlaRiskScore,
                performanceTask.Result.OutagePredictions,
            },
            ["dailyCostAnalysis"] = new
            {
                executiveTask.Result.DailyTrend,
                costTask.Result.CurrentMonthCost,
                costTask.Result.PredictedNextMonthCost,
            },
        };

        var strategicWidgetKeys = visibleWidgetKeys
            .Where(key => StrategicDashboardKeys.Contains(key, StringComparer.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (strategicWidgetKeys.Length > 0)
        {
            var strategicTasks = strategicWidgetKeys.ToDictionary(
                key => key,
                key => insightsService.GetStrategicDashboardAsync(key, tenantId, cancellationToken),
                StringComparer.OrdinalIgnoreCase);

            await Task.WhenAll(strategicTasks.Values);

            foreach (var item in strategicTasks)
            {
                visibleDashboardSnapshots[item.Key] = item.Value.Result;
            }
        }

        var payload = new
        {
            generatedAtUtc = DateTimeOffset.UtcNow,
            tenantId,
            requestedVisibleWidgetKeys = visibleWidgetKeys,
            visibleHomeDashboards = visibleDashboardSnapshots,
            executive = executiveTask.Result,
            security = securityTask.Result,
            performance = performanceTask.Result,
            cost = costTask.Result,
            governance = governanceTask.Result,
            smartFeatures = smartTask.Result,
            networkTopology = topologyTask.Result,
        };

        var rawJson = JsonSerializer.Serialize(payload);
        var scope = operationsScopeService.GetCurrent();

        string summary;
        try
        {
            var aiResult = await aiSummaryService.SummarizeWithUsageAsync(rawJson, scope.AiTarget, cancellationToken);
            summary = aiResult.Summary;
            if (aiResult.Usage is not null)
            {
                operationsScopeService.RecordAiUsage(aiResult.Usage);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI summary generation failed for tenant {TenantId}", tenantId);
            summary = "AI summary generation failed. Falling back to raw dashboard payload.\n\n" +
                      (rawJson.Length <= 6000 ? rawJson : rawJson[..6000] + "\n... (truncated)");
        }

        return Ok(new
        {
            tenantId,
            generatedAtUtc = DateTimeOffset.UtcNow,
            aiTarget = scope.AiTarget.Target,
            aiModel = scope.AiTarget.Model,
            summary,
        });
    }

    [HttpPost("consolidated/{tenantId}/pdf-summary")]
    public async Task<IActionResult> GenerateConsolidatedPdfSummary(string tenantId, CancellationToken cancellationToken)
    {
        var executiveTask = insightsService.GetExecutiveDashboardAsync(tenantId, cancellationToken);
        var securityTask = insightsService.GetSecurityDashboardAsync(tenantId, cancellationToken);
        var performanceTask = insightsService.GetPerformanceDashboardAsync(tenantId, cancellationToken);
        var costTask = insightsService.GetCostDashboardAsync(tenantId, cancellationToken);
        var governanceTask = insightsService.GetGovernanceDashboardAsync(tenantId, cancellationToken);
        var smartTask = insightsService.GetSmartFeaturesAsync(tenantId, cancellationToken);
        var topologyTask = insightsService.GetNetworkTopologyDashboardAsync(tenantId, cancellationToken);
        var capacityTask = insightsService.GetCapacityPlanningDashboardAsync(tenantId, "90d", cancellationToken);
        var anomalyTask = insightsService.GetCostAnomalyForecastDashboardAsync(tenantId, "90d", cancellationToken);

        var strategicTasks = StrategicDashboardKeys.ToDictionary(
            key => key,
            key => insightsService.GetStrategicDashboardAsync(key, tenantId, cancellationToken),
            StringComparer.OrdinalIgnoreCase);

        await Task.WhenAll(
            executiveTask,
            securityTask,
            performanceTask,
            costTask,
            governanceTask,
            smartTask,
            topologyTask,
            capacityTask,
            anomalyTask,
            Task.WhenAll(strategicTasks.Values));

        var strategicSummary = strategicTasks
            .ToDictionary(
                item => item.Key,
                item => new
                {
                    item.Value.Result.Key,
                    item.Value.Result.Title,
                    item.Value.Result.Priority,
                    item.Value.Result.GeneratedAt,
                    item.Value.Result.StructuredSummary,
                },
                StringComparer.OrdinalIgnoreCase);

        var payload = new
        {
            generatedAtUtc = DateTimeOffset.UtcNow,
            tenantId,
            executive = executiveTask.Result,
            security = securityTask.Result,
            performance = performanceTask.Result,
            cost = costTask.Result,
            governance = governanceTask.Result,
            smartFeatures = smartTask.Result,
            networkTopology = topologyTask.Result,
            capacityPlanning = capacityTask.Result,
            costAnomalyForecast = anomalyTask.Result,
            strategic = strategicSummary,
        };

        var rawJson = JsonSerializer.Serialize(payload);
        var scope = operationsScopeService.GetCurrent();

        string summary;
        try
        {
            var aiResult = await aiSummaryService.SummarizeWithUsageAsync(rawJson, scope.AiTarget, cancellationToken);
            summary = aiResult.Summary;
            if (aiResult.Usage is not null)
            {
                operationsScopeService.RecordAiUsage(aiResult.Usage);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI consolidated summary generation failed for tenant {TenantId}", tenantId);
            summary = "AI consolidated summary generation failed. Falling back to raw payload excerpt.\n\n" +
                      (rawJson.Length <= 6000 ? rawJson : rawJson[..6000] + "\n... (truncated)");
        }

        return Ok(new
        {
            tenantId,
            generatedAtUtc = DateTimeOffset.UtcNow,
            aiTarget = scope.AiTarget.Target,
            aiModel = scope.AiTarget.Model,
            dashboardsIncluded = StrategicDashboardKeys.Length + 9,
            summary,
        });
    }
}
