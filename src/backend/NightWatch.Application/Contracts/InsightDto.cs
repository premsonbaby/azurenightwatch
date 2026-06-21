namespace NightWatch.Application.Contracts;

public class InsightDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public SeverityLevel Severity { get; set; }
    public DateTime Timestamp { get; set; }
    public string TargetPage { get; set; } = string.Empty;
    public string? ResourceId { get; set; }
}

public enum SeverityLevel
{
    Critical = 0,
    High = 1,
    Medium = 2,
    Low = 3,
}
