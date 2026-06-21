using NightWatch.Application.Abstractions;

namespace NightWatch.Application.Services;

public sealed class RiskScoringService : IRiskScoringService
{
    public decimal CalculateOverallRiskScore(decimal security, decimal reliability, decimal governance, decimal cost)
    {
        var weighted = (security * 0.35m) + (reliability * 0.25m) + (governance * 0.20m) + (cost * 0.20m);
        return Math.Clamp(Math.Round(weighted, 2), 0, 100);
    }
}
