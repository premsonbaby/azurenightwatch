using NightWatch.Domain.Models;

namespace NightWatch.Application.Abstractions;

public interface IRecommendationEngine
{
    IReadOnlyCollection<Recommendation> GenerateCostRecommendations(decimal averageCpu, decimal monthlyCost);
}
