namespace NightWatch.Application.Abstractions;

public interface IWhatChangedEngine
{
    IReadOnlyCollection<string> BuildIncidentNarrative(string tenantId);
}
