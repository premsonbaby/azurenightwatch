using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using NightWatch.Application.Contracts;
using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Infrastructure.Services;

public sealed class TeamsNotificationService(
    HttpClient httpClient,
    ILogger<TeamsNotificationService> logger)
{
    public async Task<bool> SendDailyReportAsync(
        string webhookUrl,
        OperationsScopeSettings scope,
        IReadOnlyList<InsightDto> topInsights,
        string? aiSummary,
        string customerName,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var critical = topInsights.Count(x => x.Severity == SeverityLevel.Critical);
        var high = topInsights.Count(x => x.Severity == SeverityLevel.High);
        var title = string.IsNullOrWhiteSpace(customerName)
            ? "NightWatch — Daily Report"
            : $"NightWatch — {customerName} Daily Report";

        var bodyItems = new List<object>
        {
            new
            {
                type = "TextBlock",
                text = title,
                size = "Large",
                weight = "Bolder",
                color = "Accent",
                wrap = true
            },
            new
            {
                type = "TextBlock",
                text = $"{now:dddd, MMMM d, yyyy}  •  {now:HH:mm} UTC",
                size = "Small",
                isSubtle = true,
                spacing = "None"
            }
        };

        // AI executive summary paragraph
        if (!string.IsNullOrWhiteSpace(aiSummary))
        {
            bodyItems.Add(new
            {
                type = "TextBlock",
                text = aiSummary,
                wrap = true,
                spacing = "Medium"
            });
        }

        // Summary counts
        bodyItems.Add(new
        {
            type = "FactSet",
            spacing = "Medium",
            facts = new object[]
            {
                new { title = "Critical findings", value = critical == 0 ? "None" : critical.ToString() },
                new { title = "High findings", value = high == 0 ? "None" : high.ToString() },
                new { title = "Total findings", value = topInsights.Count.ToString() },
                new { title = "Subscriptions", value = scope.SubscriptionIds.Count.ToString() }
            }
        });

        // Top findings list
        var topItems = topInsights
            .Where(x => x.Severity <= SeverityLevel.High)
            .Take(5)
            .ToList();

        if (topItems.Count > 0)
        {
            bodyItems.Add(new
            {
                type = "TextBlock",
                text = "Top Findings",
                weight = "Bolder",
                spacing = "Medium",
                size = "Small"
            });

            foreach (var insight in topItems)
            {
                var icon = insight.Severity == SeverityLevel.Critical ? "🔴" : "🟡";
                bodyItems.Add(new
                {
                    type = "TextBlock",
                    text = $"{icon} **{insight.Title}**  [{insight.Category}]",
                    wrap = true,
                    spacing = "Small"
                });
            }
        }
        else
        {
            bodyItems.Add(new
            {
                type = "TextBlock",
                text = "✅ No critical or high severity findings detected.",
                color = "Good",
                spacing = "Medium",
                wrap = true
            });
        }

        bodyItems.Add(new
        {
            type = "ActionSet",
            spacing = "Medium",
            actions = new object[]
            {
                new
                {
                    type = "Action.OpenUrl",
                    title = "Open NightWatch",
                    url = "https://eun-p-nightwatch-web.azurewebsites.net",
                    style = "positive"
                }
            }
        });

        var payload = BuildAdaptiveCardPayload(bodyItems.ToArray());
        return await PostAsync(webhookUrl, payload, ct);
    }

    public async Task<bool> SendCriticalAlertAsync(
        string webhookUrl,
        string alertTitle,
        string alertBody,
        string severity,
        string customerName,
        CancellationToken ct)
    {
        var icon = severity == "Critical" ? "🔴" : severity == "High" ? "🟡" : "🔵";
        var header = string.IsNullOrWhiteSpace(customerName)
            ? $"{icon} NightWatch Alert — {severity}"
            : $"{icon} NightWatch Alert — {customerName} — {severity}";

        var payload = BuildAdaptiveCardPayload(new object[]
        {
            new
            {
                type = "TextBlock",
                text = header,
                size = "Medium",
                weight = "Bolder",
                color = severity == "Critical" ? "Attention" : "Warning",
                wrap = true
            },
            new
            {
                type = "TextBlock",
                text = alertTitle,
                size = "Medium",
                weight = "Bolder",
                spacing = "Medium",
                wrap = true
            },
            new
            {
                type = "TextBlock",
                text = alertBody,
                wrap = true,
                spacing = "Small"
            },
            new
            {
                type = "FactSet",
                spacing = "Small",
                facts = new object[]
                {
                    new { title = "Detected (UTC)", value = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd HH:mm") },
                    new { title = "Severity", value = severity }
                }
            },
            new
            {
                type = "ActionSet",
                spacing = "Medium",
                actions = new object[]
                {
                    new
                    {
                        type = "Action.OpenUrl",
                        title = "Investigate in NightWatch",
                        url = "https://eun-p-nightwatch-web.azurewebsites.net",
                        style = "destructive"
                    }
                }
            }
        });

        return await PostAsync(webhookUrl, payload, ct);
    }

    public async Task<bool> SendTestMessageAsync(string webhookUrl, CancellationToken ct)
    {
        var payload = BuildAdaptiveCardPayload(new object[]
        {
            new
            {
                type = "TextBlock",
                text = "NightWatch — Test Notification",
                size = "Medium",
                weight = "Bolder",
                color = "Good"
            },
            new
            {
                type = "TextBlock",
                text = $"Webhook connection is working. Sent at {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC.",
                wrap = true,
                spacing = "Small"
            }
        });

        return await PostAsync(webhookUrl, payload, ct);
    }

    private static object BuildAdaptiveCardPayload(object[] bodyItems) => new
    {
        type = "message",
        attachments = new[]
        {
            new
            {
                contentType = "application/vnd.microsoft.card.adaptive",
                contentUrl = (string?)null,
                content = new
                {
                    type = "AdaptiveCard",
                    version = "1.4",
                    body = bodyItems,
                    schema = "http://adaptivecards.io/schemas/adaptive-card.json"
                }
            }
        }
    };

    private async Task<bool> PostAsync(string webhookUrl, object payload, CancellationToken ct)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync(webhookUrl, payload, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Teams webhook returned {StatusCode}: {Body}", response.StatusCode, body);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to POST to Teams webhook.");
            return false;
        }
    }
}
