using NightWatch.Application.Abstractions;
using NightWatch.Domain.Models;

namespace NightWatch.Application.Services;

public sealed class RecommendationEngine : IRecommendationEngine
{
    public IReadOnlyCollection<Recommendation> GenerateCostRecommendations(decimal averageCpu, decimal monthlyCost)
    {
        var recommendations = new List<Recommendation>();

        if (averageCpu < 15)
        {
            recommendations.Add(new Recommendation(
                "Downsize low-utilization VM fleet",
                "Average CPU remained below 15% for 45+ days; rightsize to B-series instances.",
                Math.Round(monthlyCost * 0.18m, 2),
                RiskLevel.Low));
        }

        recommendations.Add(new Recommendation(
            "Enable automatic disk lifecycle",
            "Unattached managed disks and stale snapshots were detected in two subscriptions.",
            Math.Round(monthlyCost * 0.05m, 2),
            RiskLevel.Medium));

        return recommendations;
    }
}
