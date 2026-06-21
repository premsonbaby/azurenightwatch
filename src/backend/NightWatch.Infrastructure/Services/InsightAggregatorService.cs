using System.Text.Json;
using NightWatch.Application.Abstractions;
using NightWatch.Application.Contracts;
using NightWatch.Domain.Models;
using NightWatch.Infrastructure.Abstractions;

namespace NightWatch.Infrastructure.Services;

public class InsightAggregatorService : IInsightAggregatorService
{
    private readonly INightWatchInsightsService _insights;
    private readonly ISubscriptionDiscoveryService _subscriptions;
    private readonly IAdvisorClient _advisor;

    public InsightAggregatorService(
        INightWatchInsightsService insights,
        ISubscriptionDiscoveryService subscriptions,
        IAdvisorClient advisor)
    {
        _insights = insights;
        _subscriptions = subscriptions;
        _advisor = advisor;
    }

    public async Task<IEnumerable<InsightDto>> GetCriticalInsightsAsync()
    {
        var ct = CancellationToken.None;
        var insightList = new List<InsightDto>();

        // Run security findings and subscription list in parallel.
        // GetSecurityDashboardAsync uses the shared cached LiveSignals — same ARG queries
        // that power the Security dashboard, so NSG Any/Any etc. are guaranteed to appear.
        var secTask = _insights.GetSecurityDashboardAsync("feed", ct);
        var subsTask = _subscriptions.GetSubscriptionsAsync(ct);
        await Task.WhenAll(secTask, subsTask);

        var security = await secTask;
        var subs = await subsTask;

        foreach (var finding in security.Findings)
        {
            // Skip the "all clear" and "no subscriptions" placeholder findings
            if (finding.Id is "sec-live-clear" or "sec-live-nosubscriptions")
                continue;

            insightList.Add(new InsightDto
            {
                Id = Guid.NewGuid(),
                Title = finding.Title,
                Message = $"{finding.Impact} Remediation: {finding.Remediation}",
                Category = "Security",
                Severity = MapRiskLevel(finding.RiskLevel),
                Timestamp = DateTime.UtcNow,
                TargetPage = "/security"
            });
        }

        // Azure Advisor: real per-subscription recommendations across all categories
        foreach (var sub in subs)
        {
            try
            {
                var doc = await _advisor.GetRecommendationsAsync(sub.Id, ct);
                insightList.AddRange(ParseAdvisorRecommendations(doc, sub.DisplayName));
            }
            catch { }
        }

        // SeverityLevel: Critical=0, High=1, Medium=2, Low=3 — OrderBy ascending puts Critical first
        return insightList
            .OrderBy(x => x.Severity)
            .ThenByDescending(x => x.Timestamp)
            .Take(60);
    }

    private static SeverityLevel MapRiskLevel(RiskLevel riskLevel) => riskLevel switch
    {
        RiskLevel.Critical => SeverityLevel.Critical,
        RiskLevel.High => SeverityLevel.High,
        RiskLevel.Medium => SeverityLevel.Medium,
        _ => SeverityLevel.Low
    };

    private static IEnumerable<InsightDto> ParseAdvisorRecommendations(JsonDocument doc, string subscriptionName)
    {
        if (!doc.RootElement.TryGetProperty("value", out var value))
            yield break;

        foreach (var item in value.EnumerateArray())
        {
            if (!item.TryGetProperty("properties", out var props))
                continue;

            var category = props.TryGetProperty("category", out var catEl) ? catEl.GetString() ?? "General" : "General";
            var impact = props.TryGetProperty("impact", out var impactEl) ? impactEl.GetString() ?? "Low" : "Low";

            string title = string.Empty;
            string solution = string.Empty;
            if (props.TryGetProperty("shortDescription", out var desc))
            {
                title = desc.TryGetProperty("problem", out var p) ? p.GetString() ?? string.Empty : string.Empty;
                solution = desc.TryGetProperty("solution", out var s) ? s.GetString() ?? string.Empty : string.Empty;
            }

            if (string.IsNullOrWhiteSpace(title))
                continue;

            var message = string.IsNullOrWhiteSpace(solution)
                ? $"Detected in {subscriptionName}."
                : $"{solution} (Subscription: {subscriptionName})";

            if (string.Equals(category, "Cost", StringComparison.OrdinalIgnoreCase) &&
                props.TryGetProperty("extendedProperties", out var ext))
            {
                var savings = ext.TryGetProperty("savingsAmount", out var savEl) ? savEl.GetString() : null;
                var currency = ext.TryGetProperty("savingsCurrency", out var curEl) ? curEl.GetString() : null;
                if (!string.IsNullOrWhiteSpace(savings) && decimal.TryParse(savings, out var savingsVal) && savingsVal > 0)
                {
                    var currencyLabel = string.IsNullOrWhiteSpace(currency) ? "EUR" : currency;
                    message = $"{solution} Estimated monthly saving: {currencyLabel} {savingsVal:N2}. (Subscription: {subscriptionName})";
                }
            }

            yield return new InsightDto
            {
                Id = Guid.NewGuid(),
                Title = title,
                Message = message,
                Category = MapAdvisorCategory(category),
                Severity = MapAdvisorImpact(impact),
                Timestamp = DateTime.UtcNow,
                TargetPage = MapAdvisorTargetPage(category)
            };
        }
    }

    private static string MapAdvisorCategory(string advisorCategory) => advisorCategory switch
    {
        "Cost" => "Cost",
        "Security" => "Security",
        "Performance" => "Performance",
        "HighAvailability" => "Governance",
        "OperationalExcellence" => "Governance",
        _ => "General"
    };

    private static SeverityLevel MapAdvisorImpact(string impact) => impact switch
    {
        "High" => SeverityLevel.High,
        "Medium" => SeverityLevel.Medium,
        _ => SeverityLevel.Low
    };

    private static string MapAdvisorTargetPage(string advisorCategory) => advisorCategory switch
    {
        "Cost" => "/cost",
        "Security" => "/security",
        "Performance" => "/performance",
        _ => "/governance"
    };
}
