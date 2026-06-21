using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Services;
using System.Text.Json;

namespace NightWatch.Api.Controllers;

public sealed record UpdateOperationsScopeRequest(
    string? SubscriptionId,
    string[]? LogAnalyticsWorkspaceIds,
    string? AiTarget,
    string? AiEndpoint,
    string? AiModel,
    string? AiApiKey,
    DrScopeSettings? DrSettings,
    bool? AiSummaryEnabled = null);

public sealed record UpdateAiPromptRequest(string? Prompt);

public sealed record TestAiTargetRequest(
    string? AiTarget,
    string? AiEndpoint,
    string? AiModel,
    string? AiApiKey);

public sealed record OperationsWorkspaceSummary(string WorkspaceId, string DisplayName);

[ApiController]
[Route("api/operations-config")]
public class OperationsConfigController(
    IOperationsScopeService operationsScopeService,
    ISubscriptionDiscoveryService subscriptionDiscoveryService,
    IAzureResourceGraphClient azureResourceGraphClient,
    IAiSummaryService aiSummaryService,
    ILogger<OperationsConfigController> logger) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "PlatformReader")]
    public IActionResult GetCurrent()
    {
        var current = operationsScopeService.GetCurrent();
        return Ok(new
        {
            subscriptionIds = current.SubscriptionIds,
            logAnalyticsWorkspaceIds = current.LogAnalyticsWorkspaceIds,
            aiTarget = current.AiTarget.Target,
            aiEndpoint = current.AiTarget.Endpoint,
            aiModel = current.AiTarget.Model,
            aiSummaryEnabled = current.AiSummaryEnabled,
            aiApiKeyConfigured = !string.IsNullOrWhiteSpace(current.AiTarget.ApiKey),
            aiUsage = new
            {
                monthKey = current.AiUsage.MonthKey,
                promptTokens = current.AiUsage.PromptTokens,
                completionTokens = current.AiUsage.CompletionTokens,
                totalTokens = current.AiUsage.TotalTokens,
                estimatedCostUsd = current.AiUsage.EstimatedCostUsd,
                lastUpdatedUtc = current.AiUsage.LastUpdatedUtc,
            },
            aiUsageRates = new
            {
                inputTokenCostPer1kUsd = current.AiUsageRates.InputTokenCostPer1kUsd,
                outputTokenCostPer1kUsd = current.AiUsageRates.OutputTokenCostPer1kUsd,
            },
            drSettings = current.DrSettings,
            updatedAtUtc = current.UpdatedAtUtc,
        });
    }

    [HttpPut]
    [Authorize(Policy = "NightWatchOperator")]
    public IActionResult Update([FromBody] UpdateOperationsScopeRequest request)
    {
        var current = operationsScopeService.GetCurrent();
        var updated = operationsScopeService.Update(
            request.SubscriptionId,
            request.LogAnalyticsWorkspaceIds,
            request.AiTarget ?? current.AiTarget.Target,
            request.AiEndpoint ?? current.AiTarget.Endpoint,
            request.AiModel ?? current.AiTarget.Model,
            request.AiApiKey ?? current.AiTarget.ApiKey,
            request.DrSettings ?? current.DrSettings,
            request.AiSummaryEnabled);
        return Ok(new
        {
            subscriptionIds = updated.SubscriptionIds,
            logAnalyticsWorkspaceIds = updated.LogAnalyticsWorkspaceIds,
            aiTarget = updated.AiTarget.Target,
            aiEndpoint = updated.AiTarget.Endpoint,
            aiModel = updated.AiTarget.Model,
            aiSummaryEnabled = updated.AiSummaryEnabled,
            aiApiKeyConfigured = !string.IsNullOrWhiteSpace(updated.AiTarget.ApiKey),
            aiUsage = new
            {
                monthKey = updated.AiUsage.MonthKey,
                promptTokens = updated.AiUsage.PromptTokens,
                completionTokens = updated.AiUsage.CompletionTokens,
                totalTokens = updated.AiUsage.TotalTokens,
                estimatedCostUsd = updated.AiUsage.EstimatedCostUsd,
                lastUpdatedUtc = updated.AiUsage.LastUpdatedUtc,
            },
            aiUsageRates = new
            {
                inputTokenCostPer1kUsd = updated.AiUsageRates.InputTokenCostPer1kUsd,
                outputTokenCostPer1kUsd = updated.AiUsageRates.OutputTokenCostPer1kUsd,
            },
            drSettings = updated.DrSettings,
            updatedAtUtc = updated.UpdatedAtUtc,
        });
    }

    [HttpGet("access-level")]
    [Authorize(Policy = "NightWatchOperator")]
    public IActionResult GetAccessLevel() => Ok(new { isOwner = true, canEdit = true });

    [HttpGet("subscriptions")]
    [Authorize(Policy = "PlatformReader")]
    public async Task<IActionResult> GetSubscriptions(CancellationToken cancellationToken)
    {
        var subscriptions = await subscriptionDiscoveryService.GetSubscriptionsAsync(cancellationToken, ignoreScopedSelection: true);
        return Ok(subscriptions.Select(s => new
        {
            id = s.Id,
            displayName = s.DisplayName,
        }));
    }

    [HttpGet("workspaces")]
    [Authorize(Policy = "PlatformReader")]
    public async Task<IActionResult> GetWorkspaces(CancellationToken cancellationToken)
    {
        var subscriptionIds = operationsScopeService.GetCurrent().SubscriptionIds;
        if (subscriptionIds.Count == 0)
        {
            return Ok(Array.Empty<OperationsWorkspaceSummary>());
        }

        var query = "resources | where type =~ 'microsoft.operationalinsights/workspaces' | project id, name, resourceGroup | order by name asc";

        try
        {
            // Query all subscriptions in one Resource Graph call — it accepts a list of subscription IDs
            using var result = await azureResourceGraphClient.QueryResourcesAsync(query, subscriptionIds.ToList(), null, cancellationToken);
            if (!result.RootElement.TryGetProperty("data", out var dataElement) || dataElement.ValueKind != JsonValueKind.Array)
            {
                return Ok(Array.Empty<OperationsWorkspaceSummary>());
            }

            var workspaces = new List<OperationsWorkspaceSummary>();
            foreach (var row in dataElement.EnumerateArray())
            {
                var id = row.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
                var name = row.TryGetProperty("name", out var nameElement) ? nameElement.GetString() : null;
                var resourceGroup = row.TryGetProperty("resourceGroup", out var rgElement) ? rgElement.GetString() : null;

                if (string.IsNullOrWhiteSpace(id))
                {
                    continue;
                }

                var display = string.IsNullOrWhiteSpace(name)
                    ? id!
                    : string.IsNullOrWhiteSpace(resourceGroup)
                        ? name!
                        : $"{name} ({resourceGroup})";

                workspaces.Add(new OperationsWorkspaceSummary(id!, display));
            }

            return Ok(workspaces);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to enumerate workspaces across {Count} subscription(s)", subscriptionIds.Count);
            return Ok(Array.Empty<OperationsWorkspaceSummary>());
        }
    }

    [HttpGet("ai-prompt")]
    [Authorize(Policy = "PlatformReader")]
    public IActionResult GetAiPrompt()
    {
        var stored = operationsScopeService.GetAiBriefingPrompt();
        return Ok(new
        {
            prompt = stored ?? ReportServiceDefaults.AiBriefingPrompt,
            isCustom = stored is not null,
            defaultPrompt = ReportServiceDefaults.AiBriefingPrompt,
        });
    }

    [HttpPut("ai-prompt")]
    [Authorize(Policy = "NightWatchOperator")]
    public IActionResult UpdateAiPrompt([FromBody] UpdateAiPromptRequest request)
    {
        operationsScopeService.SetAiBriefingPrompt(request.Prompt);
        return Ok(new { saved = true });
    }

    [HttpDelete("ai-prompt")]
    [Authorize(Policy = "NightWatchOperator")]
    public IActionResult ResetAiPrompt()
    {
        operationsScopeService.SetAiBriefingPrompt(null);
        return Ok(new { reset = true, prompt = ReportServiceDefaults.AiBriefingPrompt });
    }

    [HttpPost("ai/test")]
    [Authorize(Policy = "PlatformReader")]
    public async Task<IActionResult> TestAiTarget([FromBody] TestAiTargetRequest? request, CancellationToken cancellationToken)
    {
        var scope = operationsScopeService.GetCurrent();
        var effectiveAiTarget = new AiTargetSettings(
            string.IsNullOrWhiteSpace(request?.AiTarget) ? scope.AiTarget.Target : request!.AiTarget!.Trim(),
            string.IsNullOrWhiteSpace(request?.AiEndpoint) ? scope.AiTarget.Endpoint : request!.AiEndpoint!.Trim(),
            string.IsNullOrWhiteSpace(request?.AiModel) ? scope.AiTarget.Model : request!.AiModel!.Trim(),
            string.IsNullOrWhiteSpace(request?.AiApiKey) ? scope.AiTarget.ApiKey : request!.AiApiKey!.Trim());

        if (string.Equals(effectiveAiTarget.Target, "none", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(new
            {
                reachable = false,
                fallback = true,
                target = effectiveAiTarget.Target,
                model = effectiveAiTarget.Model,
                message = "AI target is not configured. Select Azure OpenAI / Foundry, enter the Azure endpoint, the deployment name (for example, gpt-4.1), and the API key, then save the AI target.",
            });
        }

        var missingFields = new List<string>();
        if (string.IsNullOrWhiteSpace(effectiveAiTarget.Endpoint))
        {
            missingFields.Add("endpoint");
        }

        if (string.IsNullOrWhiteSpace(effectiveAiTarget.Model))
        {
            missingFields.Add("model/deployment");
        }

        if (string.IsNullOrWhiteSpace(effectiveAiTarget.ApiKey))
        {
            missingFields.Add("API key");
        }

        if (missingFields.Count > 0)
        {
            return Ok(new
            {
                reachable = false,
                fallback = true,
                target = effectiveAiTarget.Target,
                model = effectiveAiTarget.Model,
                message = $"AI target is missing {string.Join(", ", missingFields)}. For Azure OpenAI, the model field must be the deployment name, such as gpt-4.1, not the base model name.",
            });
        }

        try
        {
            var summaryResult = await aiSummaryService.SummarizeWithUsageAsync(
                "{\"test\":\"NightWatch AI connectivity check\",\"timestamp\":\"" + DateTimeOffset.UtcNow.ToString("O") + "\"}",
                effectiveAiTarget,
                cancellationToken);

            if (summaryResult.Usage is not null)
            {
                operationsScopeService.RecordAiUsage(summaryResult.Usage);
            }

            var isFallback = summaryResult.Summary.StartsWith("AI summarization target is not configured", StringComparison.OrdinalIgnoreCase);

            var message = isFallback
                ? effectiveAiTarget.Target.Equals("azure-openai", StringComparison.OrdinalIgnoreCase)
                    ? "Azure OpenAI returned a fallback summary. Verify that the endpoint is the resource root (for example, https://your-resource.openai.azure.com), the model field is the deployment name (for example, gpt-4.1), and the API key is valid for that resource."
                    : "OpenAI-compatible endpoint returned a fallback summary. Verify the endpoint format, model name, and API key."
                : $"AI target responded successfully using {effectiveAiTarget.Target} with model/deployment '{effectiveAiTarget.Model}'.";

            return Ok(new
            {
                reachable = !isFallback,
                fallback = isFallback,
                target = effectiveAiTarget.Target,
                model = effectiveAiTarget.Model,
                message,
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI target test failed.");
            return Ok(new
            {
                reachable = false,
                fallback = true,
                target = effectiveAiTarget.Target,
                model = effectiveAiTarget.Model,
                message = effectiveAiTarget.Target.Equals("azure-openai", StringComparison.OrdinalIgnoreCase)
                    ? "AI target test failed. For Azure OpenAI, use the resource endpoint, not a chat/completions path, and set the model field to the deployment name such as gpt-4.1. Also verify the API key belongs to that resource."
                    : "AI target test failed. Verify endpoint, model name, and API key.",
            });
        }
    }
}
