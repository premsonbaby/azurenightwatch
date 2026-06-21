namespace NightWatch.Application.Abstractions;

public interface IInsightPlugin
{
    string Name { get; }
    IReadOnlyCollection<string> Analyze(string tenantId);
}
