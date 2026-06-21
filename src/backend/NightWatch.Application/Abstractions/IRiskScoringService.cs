namespace NightWatch.Application.Abstractions;

public interface IRiskScoringService
{
    decimal CalculateOverallRiskScore(decimal security, decimal reliability, decimal governance, decimal cost);
}
