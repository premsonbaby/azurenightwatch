namespace NightWatch.Domain.Models;

public enum RiskLevel
{
    Low,
    Medium,
    High,
    Critical
}

public enum EnvironmentMaturity
{
    Beginner,
    Intermediate,
    Enterprise,
    Optimized
}

public sealed record ScoreComponent(string Name, decimal Value, string Trend);

public sealed record Recommendation(string Title, string Description, decimal EstimatedMonthlySavings, RiskLevel RiskLevel);

public sealed record RiskEvent(DateTimeOffset Timestamp, string Category, RiskLevel Level, string Description);

public sealed record GraphNode(string Id, string Label, string Type);

public sealed record GraphEdge(string Source, string Target, string Relationship);

public sealed record SecurityFinding(string Id, string Title, RiskLevel RiskLevel, string ResourceId, string Impact, string Remediation);
