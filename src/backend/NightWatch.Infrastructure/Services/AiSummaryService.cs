using NightWatch.Infrastructure.Abstractions;
using NightWatch.Infrastructure.Options;
using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services;

public sealed class AiSummaryService(
    HttpClient httpClient,
    IOptions<AzureOperationsOptions> options) : IAiSummaryService
{
    private const string AzureOpenAiApiVersion = "2024-06-01";

    public async Task<AiSummaryResult> SummarizeWithUsageAsync(
        string fullDashboardJson,
        AiTargetSettings aiTarget,
        CancellationToken cancellationToken)
    {
        var target = aiTarget.Target.Trim().ToLowerInvariant();
        return target switch
        {
            "azure-openai" => await SummarizeWithAzureOpenAiAsync(fullDashboardJson, aiTarget, cancellationToken),
            "openai" => await SummarizeWithOpenAiAsync(fullDashboardJson, aiTarget, cancellationToken),
            _ => new AiSummaryResult(BuildFallbackSummary(fullDashboardJson), null),
        };
    }

    public async Task<string> SummarizeAsync(
        string fullDashboardJson,
        AiTargetSettings aiTarget,
        CancellationToken cancellationToken)
    {
        var result = await SummarizeWithUsageAsync(fullDashboardJson, aiTarget, cancellationToken);
        return result.Summary;
    }

    private async Task<AiSummaryResult> SummarizeWithAzureOpenAiAsync(
        string fullDashboardJson,
        AiTargetSettings aiTarget,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(aiTarget.Endpoint) ||
            string.IsNullOrWhiteSpace(aiTarget.Model) ||
            string.IsNullOrWhiteSpace(aiTarget.ApiKey))
        {
            return new AiSummaryResult(BuildFallbackSummary(fullDashboardJson), null);
        }

        var endpoint = aiTarget.Endpoint.TrimEnd('/');
        var requestUri = $"{endpoint}/openai/deployments/{Uri.EscapeDataString(aiTarget.Model)}/chat/completions?api-version={AzureOpenAiApiVersion}";

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = new StringContent(BuildChatPayload(fullDashboardJson, aiTarget.Model, useModelField: false), Encoding.UTF8, "application/json"),
        };

        request.Headers.Add("api-key", aiTarget.ApiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return new AiSummaryResult(BuildFallbackSummary(fullDashboardJson), null);
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return BuildSummaryResult(content, fullDashboardJson);
    }

    private async Task<AiSummaryResult> SummarizeWithOpenAiAsync(
        string fullDashboardJson,
        AiTargetSettings aiTarget,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(aiTarget.Endpoint) ||
            string.IsNullOrWhiteSpace(aiTarget.Model) ||
            string.IsNullOrWhiteSpace(aiTarget.ApiKey))
        {
            return new AiSummaryResult(BuildFallbackSummary(fullDashboardJson), null);
        }

        var endpoint = aiTarget.Endpoint.TrimEnd('/');
        var requestUri = endpoint.EndsWith("/v1", StringComparison.OrdinalIgnoreCase)
            ? $"{endpoint}/chat/completions"
            : $"{endpoint}/v1/chat/completions";

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
        {
            Content = new StringContent(BuildChatPayload(fullDashboardJson, aiTarget.Model, useModelField: true), Encoding.UTF8, "application/json"),
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", aiTarget.ApiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return new AiSummaryResult(BuildFallbackSummary(fullDashboardJson), null);
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return BuildSummaryResult(content, fullDashboardJson);
    }

    private AiSummaryResult BuildSummaryResult(string json, string fullDashboardJson)
    {
        var chatContent = TryReadChatContent(json);
        if (string.IsNullOrWhiteSpace(chatContent))
        {
            return new AiSummaryResult(BuildFallbackSummary(fullDashboardJson), null);
        }

        var usage = TryReadUsage(json);
        if (usage is null)
        {
            return new AiSummaryResult(chatContent, null);
        }

        var estimatedCost = ((usage.Value.promptTokens / 1000m) * options.Value.AiInputTokenCostPer1kUsd)
            + ((usage.Value.completionTokens / 1000m) * options.Value.AiOutputTokenCostPer1kUsd);

        return new AiSummaryResult(
            chatContent,
            new AiUsageSample(
                usage.Value.promptTokens,
                usage.Value.completionTokens,
                estimatedCost,
                DateTimeOffset.UtcNow));
    }

    private static string BuildChatPayload(string fullDashboardJson, string model, bool useModelField)
    {
        var systemPrompt =
            "You are generating an OFFICIAL Azure NightWatch Executive Operations Report used as the narrative body for a PDF shared with leadership. " +
            "Audience: CIO, CISO, CTO, FinOps lead, and Cloud Operations leadership. " +
            "\n\n" +
            "Report intent and expectations:" +
            "\n- This is an executive decision report, not a generic summary." +
            "\n- Use only facts present in the input JSON. Do not invent metrics, incidents, trends, or recommendations." +
            "\n- Prioritize clarity, business impact, and actionability." +
            "\n- Keep tone formal, concise, and audit-friendly." +
            "\n\n" +
            "Output format requirements (plain text only):" +
            "\n1) Executive Overview (5-8 bullets)" +
            "\n2) Overall Posture Scores (health, security, performance, cost, reliability, governance)" +
            "\n3) Top 10 Risks and Actions (ordered by urgency; include rationale and expected impact)" +
            "\n4) Security Highlights" +
            "\n5) Reliability and Performance Highlights" +
            "\n6) Cost and Savings Highlights" +
            "\n7) Governance and Compliance Highlights" +
            "\n8) Network Topology and Resilience Highlights" +
            "\n9) Action Plan by Horizon: Immediate (0-24h), This Week, This Month" +
            "\n10) Data Quality and Gaps (what appears missing/limited in telemetry)" +
            "\n\n" +
            "Formatting rules:" +
            "\n- Use short section headings and bullet points." +
            "\n- Include concrete values when available." +
            "\n- If data is missing, explicitly state \"Not available in provided telemetry\".";

        var messages = new object[]
        {
            new { role = "system", content = systemPrompt },
            new
            {
                role = "user",
                content =
                    "Create the official Azure NightWatch Executive Operations PDF narrative from the full Home dashboard payload below. " +
                    "The payload includes all visible Home modules and supporting telemetry.\n\n" +
                    $"JSON payload:\n{fullDashboardJson}"
            },
        };

        if (useModelField)
        {
            return JsonSerializer.Serialize(new
            {
                model,
                temperature = 0.2,
                messages,
            });
        }

        return JsonSerializer.Serialize(new
        {
            temperature = 0.2,
            messages,
        });
    }

    private static string? TryReadChatContent(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array || choices.GetArrayLength() == 0)
            {
                return null;
            }

            var first = choices[0];
            if (!first.TryGetProperty("message", out var message))
            {
                return null;
            }

            if (!message.TryGetProperty("content", out var content))
            {
                return null;
            }

            if (content.ValueKind == JsonValueKind.String)
            {
                return content.GetString();
            }

            if (content.ValueKind == JsonValueKind.Array)
            {
                var builder = new StringBuilder();
                foreach (var part in content.EnumerateArray())
                {
                    if (part.TryGetProperty("text", out var textPart) && textPart.ValueKind == JsonValueKind.String)
                    {
                        builder.AppendLine(textPart.GetString());
                    }
                }

                var combined = builder.ToString().Trim();
                return string.IsNullOrWhiteSpace(combined) ? null : combined;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    private static (long promptTokens, long completionTokens)? TryReadUsage(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("usage", out var usage))
            {
                return null;
            }

            long promptTokens = 0;
            long completionTokens = 0;

            if (usage.TryGetProperty("prompt_tokens", out var promptElement) && promptElement.TryGetInt64(out var prompt))
            {
                promptTokens = prompt;
            }

            if (usage.TryGetProperty("completion_tokens", out var completionElement) && completionElement.TryGetInt64(out var completion))
            {
                completionTokens = completion;
            }

            return (promptTokens, completionTokens);
        }
        catch
        {
            return null;
        }
    }

    private static string BuildFallbackSummary(string fullDashboardJson)
    {
        const int maxLength = 6000;
        var compact = fullDashboardJson.Length <= maxLength
            ? fullDashboardJson
            : fullDashboardJson[..maxLength] + "\n... (truncated)";

        return "AI summarization target is not configured or unavailable. " +
               "Below is a raw consolidated dashboard snapshot for offline review:\n\n" +
               compact;
    }
}
